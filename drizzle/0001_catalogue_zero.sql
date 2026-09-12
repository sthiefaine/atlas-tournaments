-- Nouvelle base commune : le catalogue actuel devient 0.
-- Migration jouée une seule fois par scripts/migrate.mjs ; aucun contenu supprimé.
alter table scenarios alter column catalogue_version set default 0;
alter table unit_types alter column catalogue_version set default 0;
alter table daily_missions alter column catalogue_version set default 0;

-- Les capacités des commandants ont leur propre révision : figer l'ancien
-- choix implicite avant de remettre à zéro le numéro de catalogue.
update scenarios
set donnees = jsonb_set(
  case when donnees ? 'commandantsVersion' then donnees
    else jsonb_set(donnees, '{commandantsVersion}',
      to_jsonb(case when catalogue_version >= 7 then 2 else 1 end), true)
  end,
  '{catalogueVersion}', '0'::jsonb, true
), catalogue_version = 0;

update unit_types
set catalogue_version = 0,
    donnees = case when jsonb_typeof(donnees->'homologation') = 'object'
      then jsonb_set(donnees, '{homologation,catalogue}', '0'::jsonb, true)
      else donnees end;
update daily_missions set catalogue_version = 0;
insert into compteurs (cle, valeur) values ('catalogue_version', 0)
on conflict (cle) do update set valeur = 0, maj_le = now();
