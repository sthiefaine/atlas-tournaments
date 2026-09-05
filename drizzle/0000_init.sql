-- Atlas Tournament — migration initiale.
--
-- Tables de `doc/02-architecture.md` §3.6, complétées par `doc/05-routines.md`
-- (missions de routine, journal des runs) et `doc/09-i18n.md` (locales, chaînes,
-- traductions, glossaires).
--
-- Conventions :
--   - les NOMS DE TABLES sont en anglais (brief), les NOMS DE COLONNES en français ;
--   - les statuts sont stockés SANS ACCENT (`valide`, `en_ligne`) et bornés par des
--     contraintes `check` : une valeur hors énumération est refusée par la base, pas
--     seulement par le code ;
--   - rien n'est jamais supprimé : `retire` remplace la suppression (§6) ;
--   - le fichier est REJOUABLE sur une base vierge (`if not exists` partout).

-- ---------------------------------------------------------------------------
-- 0. Compteurs globaux : catalogueVersion et chainesVersion
-- ---------------------------------------------------------------------------

create table if not exists compteurs (
  cle    text primary key,
  valeur integer not null default 1,
  maj_le timestamptz not null default now(),
  constraint compteurs_cle_connue check (cle in ('catalogue_version', 'chaines_version'))
);

insert into compteurs (cle, valeur) values ('catalogue_version', 1), ('chaines_version', 1)
  on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- 1. ai_prompts — le prompt métier versionné (05 §1.2, §5.4)
-- ---------------------------------------------------------------------------

create table if not exists ai_prompts (
  id               text primary key,
  cle              text        not null,
  version          integer     not null,
  corps            text        not null,
  sections         jsonb       not null default '{}'::jsonb,
  auteur           text        not null,
  auteur_ref       text,
  statut           text        not null default 'propose',
  justification    text        not null default '',
  diff_resume      jsonb       not null default '[]'::jsonb,
  metriques        jsonb,
  parent_version   integer,
  valide_par_humain boolean    not null default false,
  created_at       timestamptz not null default now(),
  active_le        timestamptz,
  constraint ai_prompts_cle_connue check (cle in
    ('atlas_lore', 'atlas_map', 'atlas_controle', 'atlas_cerveau', 'atlas_traduction')),
  constraint ai_prompts_statut_connu check (statut in ('propose', 'courant', 'retire')),
  constraint ai_prompts_auteur_connu check (auteur in ('humain', 'atlas_cerveau')),
  constraint ai_prompts_version_positive check (version >= 1)
);

-- Unicité clé + version : une version n'est jamais réutilisée.
create unique index if not exists ai_prompts_cle_version_uniq on ai_prompts (cle, version);
-- Une seule ligne `courant` par clé : c'est la garantie du retour arrière propre.
create unique index if not exists ai_prompts_un_courant on ai_prompts (cle) where statut = 'courant';

-- ---------------------------------------------------------------------------
-- 2. routine_runs — le journal (05 §1.8)
-- ---------------------------------------------------------------------------

create table if not exists routine_runs (
  id                text primary key,
  routine           text        not null,
  prompt_version    integer,
  demarre_le        timestamptz not null default now(),
  fini_le           timestamptz,
  statut            text        not null default 'en_cours',
  missions_recues   integer     not null default 0,
  missions_soumises integer     not null default 0,
  appels            integer     not null default 0,
  bilan             text,
  erreurs           jsonb       not null default '[]'::jsonb,
  constraint routine_runs_routine_connue check (routine in
    ('atlas_lore', 'atlas_map', 'atlas_controle', 'atlas_cerveau', 'atlas_traduction')),
  constraint routine_runs_statut_connu check (statut in ('en_cours', 'ok', 'partiel', 'echec', 'coupe'))
);

create index if not exists routine_runs_routine_demarre on routine_runs (routine, demarre_le desc);
create index if not exists routine_runs_ouverts on routine_runs (routine) where fini_le is null;

-- ---------------------------------------------------------------------------
-- 3. routine_missions — l'unité de travail réservée (05 §1.5)
-- ---------------------------------------------------------------------------

create table if not exists routine_missions (
  id              text primary key,
  routine         text        not null,
  kind            text        not null,
  cible_type      text        not null,
  cible_cle       text        not null,
  statut          text        not null default 'ouverte',
  priorite        integer     not null default 100,
  echeance        timestamptz,
  ouverte_depuis  timestamptz not null default now(),
  close_le        timestamptz,
  run_id          text,
  contexte        jsonb       not null default '{}'::jsonb,
  reponse         jsonb,
  idempotency_key text,
  constraint routine_missions_routine_connue check (routine in
    ('atlas_lore', 'atlas_map', 'atlas_controle', 'atlas_cerveau', 'atlas_traduction')),
  constraint routine_missions_statut_connu check (statut in
    ('ouverte', 'soumise', 'rendue', 'quarantaine', 'expiree'))
);

create index if not exists routine_missions_file on routine_missions (routine, statut, priorite, ouverte_depuis);
-- Une seule mission ouverte à la fois par cible : pas de double réservation.
create unique index if not exists routine_missions_cible_ouverte
  on routine_missions (routine, cible_type, cible_cle) where statut = 'ouverte';

-- ---------------------------------------------------------------------------
-- 4. countries / commanders — le lore
-- ---------------------------------------------------------------------------

create table if not exists countries (
  id      text primary key,
  code    text        not null unique,
  donnees jsonb       not null,
  statut  text        not null default 'brouillon',
  version integer     not null default 1,
  source  text        not null default 'atlas_lore',
  cree_le timestamptz not null default now(),
  maj_le  timestamptz not null default now(),
  constraint countries_statut_connu check (statut in
    ('brouillon', 'en_controle', 'valide', 'rejete', 'en_ligne', 'quarantaine', 'retire'))
);

create index if not exists countries_statut on countries (statut);

create table if not exists commanders (
  id        text primary key,
  code      text        not null unique,
  pays_code text        not null,
  donnees   jsonb       not null,
  statut    text        not null default 'brouillon',
  version   integer     not null default 1,
  source    text        not null default 'atlas_lore',
  cree_le   timestamptz not null default now(),
  maj_le    timestamptz not null default now(),
  constraint commanders_statut_connu check (statut in
    ('brouillon', 'en_controle', 'valide', 'rejete', 'en_ligne', 'quarantaine', 'retire'))
);

create index if not exists commanders_pays on commanders (pays_code);
create index if not exists commanders_statut on commanders (statut);

-- ---------------------------------------------------------------------------
-- 5. maps / scenarios — les cartes et les missions jouables
-- ---------------------------------------------------------------------------

create table if not exists maps (
  id          text primary key,
  code        text        not null unique,
  donnees     jsonb,
  graine      text        not null,
  parametres  jsonb       not null,
  statut      text        not null default 'brouillon',
  diagnostic  jsonb,
  apercu      jsonb,
  iterations  integer     not null default 0,
  version     integer     not null default 1,
  source      text        not null default 'atlas_map',
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  constraint maps_statut_connu check (statut in
    ('brouillon', 'en_controle', 'valide', 'rejete', 'en_ligne', 'quarantaine', 'retire')),
  -- Une seule itération d'aperçu (05 §3.3) : au-delà, `409 ITERATION_EPUISEE`.
  constraint maps_iterations_bornees check (iterations between 0 and 1)
);

create index if not exists maps_statut on maps (statut);

create table if not exists scenarios (
  id                text primary key,
  code              text        not null unique,
  map_id            text,
  donnees           jsonb       not null,
  statut            text        not null default 'brouillon',
  acte              integer     not null default 0,
  pays_code         text        not null,
  date              date        not null,
  catalogue_version integer     not null default 1,
  chaines_version   integer     not null default 1,
  version           integer     not null default 1,
  source            text        not null default 'atlas_map',
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now(),
  constraint scenarios_statut_connu check (statut in
    ('brouillon', 'en_controle', 'valide', 'rejete', 'en_ligne', 'quarantaine', 'retire'))
);

create index if not exists scenarios_date on scenarios (date desc);
create index if not exists scenarios_catalogue on scenarios (catalogue_version);
create index if not exists scenarios_statut on scenarios (statut);

-- ---------------------------------------------------------------------------
-- 6. reviews — le journal d'audit du gardien (05 §4.2)
-- ---------------------------------------------------------------------------

create table if not exists reviews (
  id             text primary key,
  cle            text        not null,
  cible_type     text        not null,
  cible_cle      text        not null,
  cible_version  integer     not null default 1,
  verdict        text        not null,
  motifs         jsonb       not null default '[]'::jsonb,
  codes_motifs   text[]      not null default '{}',
  stats          jsonb,
  coherence_lore numeric(4, 3),
  suggestions    jsonb       not null default '[]'::jsonb,
  routine_run_id text,
  created_at     timestamptz not null default now(),
  constraint reviews_verdict_connu check (verdict in ('valide', 'rejete')),
  constraint reviews_cible_connue check (cible_type in
    ('carte', 'scenario', 'commandant', 'pays', 'region', 'evenement', 'unite'))
);

create index if not exists reviews_cible on reviews (cible_type, cible_cle);
create index if not exists reviews_motifs on reviews using gin (codes_motifs);
create index if not exists reviews_date on reviews (created_at desc);

-- ---------------------------------------------------------------------------
-- 7. events — l'actualité (05 §5.2, §5.5)
-- ---------------------------------------------------------------------------

create table if not exists events (
  id                text primary key,
  code              text        not null unique,
  source_url        text        not null default '',
  source_nom        text        not null default '',
  categorie         text        not null,
  donnees           jsonb       not null,
  inspiration       jsonb,
  depeche_jour      date,
  debut             date,
  fin               date,
  statut            text        not null default 'brouillon',
  valide_par_humain boolean     not null default false,
  version           integer     not null default 1,
  source            text        not null default 'atlas_cerveau',
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now(),
  constraint events_categorie_connue check (categorie in
    ('competition_sportive', 'festival', 'meteo', 'decouverte', 'culture', 'anniversaire')),
  constraint events_statut_connu check (statut in
    ('brouillon', 'en_controle', 'valide', 'rejete', 'en_ligne', 'quarantaine', 'retire'))
);

-- Un seul Event de dépêche par jour réel (05 §5.5, `409 DEPECHE_DEJA_PROPOSEE`).
create unique index if not exists events_depeche_par_jour on events (depeche_jour) where depeche_jour is not null;
create index if not exists events_statut on events (statut);

-- Le calendrier de récurrences et le digest servis à `atlas_cerveau` (05 §5.2).
create table if not exists actualite_items (
  id        text primary key,
  categorie text        not null,
  titre     text        not null,
  date      date        not null,
  source    text        not null default 'calendrier_interne',
  pays      text[]      not null default '{}',
  utilise_le date,
  cree_le   timestamptz not null default now(),
  constraint actualite_categorie_connue check (categorie in
    ('competition_sportive', 'festival', 'meteo', 'decouverte', 'culture', 'anniversaire')),
  constraint actualite_source_connue check (source in ('calendrier_interne', 'digest_admin'))
);

create index if not exists actualite_items_date on actualite_items (date);

-- ---------------------------------------------------------------------------
-- 8. memory — la mémoire structurée (05 §5.3)
-- ---------------------------------------------------------------------------

create table if not exists memory (
  id          text primary key,
  cle         text        not null unique,
  date        date        not null,
  source      text        not null,
  source_ref  text,
  sujet       text        not null,
  portee      text        not null,
  portee_ref  text,
  contenu     jsonb       not null,
  poids       integer     not null default 1,
  occurrences integer     not null default 1,
  expire_le   date,
  archivee    boolean     not null default false,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  constraint memory_source_connue check (source in
    ('humain', 'atlas_controle', 'atlas_cerveau', 'simulation', 'incident')),
  constraint memory_poids_borne check (poids between 1 and 10)
);

create index if not exists memory_portee on memory (portee, archivee, expire_le);

-- ---------------------------------------------------------------------------
-- 9. unit_types — le catalogue vivant (02 §3.6, 05 §9)
-- ---------------------------------------------------------------------------

create table if not exists unit_types (
  id                text primary key,
  cle               text        not null unique,
  donnees           jsonb       not null,
  statut            text        not null default 'essai',
  statut_cycle      text        not null default 'brouillon',
  catalogue_version integer     not null default 1,
  traits            text[]      not null default '{}',
  silhouette        jsonb       not null,
  essai_jusqu_au    date,
  homologuee_le     date,
  source_event_id   text,
  version           integer     not null default 1,
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now(),
  constraint unit_types_statut_connu check (statut in ('canon', 'essai', 'homologuee', 'retiree')),
  constraint unit_types_cycle_connu check (statut_cycle in
    ('brouillon', 'en_controle', 'valide', 'rejete', 'en_ligne', 'quarantaine', 'retire')),
  constraint unit_types_traits_bornes check (cardinality(traits) <= 2)
);

create index if not exists unit_types_statut on unit_types (statut);
create index if not exists unit_types_traits on unit_types using gin (traits);

-- ---------------------------------------------------------------------------
-- 10. daily_missions — La Dépêche du jour (05 §8)
-- ---------------------------------------------------------------------------

create table if not exists daily_missions (
  id                text primary key,
  date              date        not null unique,  -- « au plus une mission par jour réel »
  event_id          text,
  scenario_id       text,
  pays_code         text,
  statut            text        not null default 'brouillon',
  expire_le         date,
  catalogue_version integer     not null default 1,
  chaines_version   integer     not null default 1,
  etape_manquee     text,
  valide_par        text,
  valide_le         timestamptz,
  motif_refus       text,
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now(),
  constraint daily_missions_statut_connu check (statut in
    ('brouillon', 'en_controle', 'valide', 'rejete', 'en_ligne', 'quarantaine', 'retire'))
);

create index if not exists daily_missions_statut on daily_missions (statut, date desc);

-- ---------------------------------------------------------------------------
-- 11. locales / chaines_source / traductions / glossaires (09 §2)
-- ---------------------------------------------------------------------------

create table if not exists locales (
  id                text primary key,
  code              text          not null unique,
  nom               text          not null,
  script            text          not null,
  sens              text          not null default 'ltr',
  statut            text          not null default 'en_preparation',
  seuil_couverture  numeric(4, 3) not null default 1.0,
  facteur_longueur  numeric(4, 3) not null default 1.0,
  echantillon_humain integer      not null default 20,
  ordre             integer       not null default 100,
  registre          text          not null default '',
  maj_le            timestamptz   not null default now(),
  constraint locales_script_connu check (script in ('latin', 'cyrillique', 'han_simplifie', 'kana_kanji')),
  constraint locales_sens_connu check (sens in ('ltr', 'rtl')),
  constraint locales_statut_connu check (statut in ('en_preparation', 'active')),
  constraint locales_facteur_borne check (facteur_longueur between 0.5 and 1.5)
);

create index if not exists locales_ordre on locales (ordre);

create table if not exists chaines_source (
  cle            text        primary key,
  texte          text        not null,
  origine        text        not null,
  contexte       jsonb       not null default '{}'::jsonb,
  longueur_max   integer,
  placeholders   text[]      not null default '{}',
  pluriel        boolean     not null default false,
  source_hash    char(16)    not null,
  version_chaine integer     not null default 1,
  objet_ref      jsonb,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now(),
  constraint chaines_origine_connue check (origine in ('interface', 'canon', 'genere'))
);

create index if not exists chaines_source_origine on chaines_source (origine);

create table if not exists traductions (
  id               text        primary key,
  cle_chaine       text        not null references chaines_source (cle) on delete cascade,
  locale           text        not null,
  texte            text,
  statut           text        not null default 'manquante',
  source_hash      char(16)    not null,
  version_chaine   integer     not null default 1,
  auteur           text        not null default 'atlas_traduction',
  relue_par_humain boolean     not null default false,
  run_ref          text,
  cree_le          timestamptz not null default now(),
  maj_le           timestamptz not null default now(),
  constraint traductions_statut_connu check (statut in ('manquante', 'brouillon', 'validee', 'perimee')),
  constraint traductions_auteur_connu check (auteur in ('atlas_traduction', 'humain')),
  -- Le français est la source : il n'existe pas de traduction vers `fr` (09 §1).
  constraint traductions_jamais_fr check (locale <> 'fr')
);

-- Unicité clé + locale : la clé primaire logique de 02 §3.6.
create unique index if not exists traductions_cle_locale on traductions (cle_chaine, locale);
-- L'index qui produit le tri par pénurie de 09 §8.2.
create index if not exists traductions_penurie on traductions (locale, statut);

create table if not exists glossaires (
  id               text        primary key,
  locale           text        not null unique,
  entrees          jsonb       not null default '[]'::jsonb,
  termes_interdits text[]      not null default '{}',
  maj_le           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 12. Les neuf langues du lancement (09 §1). `fr` est la source, `en` le repli.
-- ---------------------------------------------------------------------------

insert into locales (id, code, nom, script, sens, statut, facteur_longueur, echantillon_humain, ordre) values
  ('loc_fr',      'fr',      'Français',   'latin',        'ltr', 'active',          1.00, 0,  1),
  ('loc_en',      'en',      'English',    'latin',        'ltr', 'active',          0.90, 0,  2),
  ('loc_de',      'de',      'Deutsch',    'latin',        'ltr', 'en_preparation',  1.20, 20, 3),
  ('loc_pt_br',   'pt-br',   'Português (Brasil)', 'latin', 'ltr', 'en_preparation', 1.10, 20, 4),
  ('loc_es',      'es',      'Español',    'latin',        'ltr', 'en_preparation',  1.10, 20, 5),
  ('loc_it',      'it',      'Italiano',   'latin',        'ltr', 'en_preparation',  1.05, 20, 6),
  ('loc_ru',      'ru',      'Русский',    'cyrillique',   'ltr', 'en_preparation',  1.15, 20, 7),
  ('loc_zh_hans', 'zh-hans', '简体中文',    'han_simplifie', 'ltr', 'en_preparation', 0.55, 20, 8),
  ('loc_ja',      'ja',      '日本語',      'kana_kanji',   'ltr', 'en_preparation',  0.70, 20, 9)
on conflict (code) do nothing;
