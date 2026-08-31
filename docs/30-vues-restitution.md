# 30 · Les vues de restitution — `reporting.*`

**INT-05** ([`27`](27-comite-interoperabilite.md) §3). Le schéma
`reporting` est le contrat de lecture pour les outils décisionnels :
Power BI, Excel, Tableau et Qlik parlent PostgreSQL nativement, et ces
quatorze vues sont ce qu'ils lisent. **Noms et colonnes sont stables** :
en retirer ou en renommer une est un changement MAJEUR au sens du
[CHANGELOG](../CHANGELOG.md) — un exploitant doit être prévenu avant de
monter de version.

## Se brancher

Sur l'instance PostgreSQL (jamais sur PGlite — voir PG-01) :

```sql
CREATE ROLE reporting_reader LOGIN PASSWORD '…';
GRANT USAGE ON SCHEMA reporting TO reporting_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO reporting_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting
  GRANT SELECT ON TABLES TO reporting_reader;
```

Puis, dans l'outil : source PostgreSQL, base de l'instance, schéma
`reporting`, ce rôle. Rien d'autre.

## Ce que ces vues ne donnent pas, et pourquoi

- **Aucun nombre de valeur acquise** (VA, IPC, IPP, CFE). Cette
  arithmétique vit dans `shared/engine.js`, gelée ; la refaire en SQL
  créerait une seconde vérité. L'EVM se lit sur `/api/v1/portfolio`,
  qui sort du même sérialiseur que l'écran.
- **Ni comptes, ni sessions, ni clés, ni images avant/après** de la
  piste (`before_json` peut contenir ce qu'une ligne effacée contenait).
  La piste complète passe par la portée d'API `read:audit`, qui se
  révoque à la clé ; un accès SQL ne se révoque pas ainsi.
- **L'argent est en unités entières** de la devise de restitution, comme
  en base. Le formatage appartient à l'outil ; un million divisé deux
  fois est le défaut qu'on met six mois à voir.

## Les vues

| Vue | Une ligne par | Colonnes |
|---|---|---|
| `sites` | site | id, city, region, country (ISO 3166), legal_entity, tz_name, headcount, fte, active |
| `programmes` | programme | id, name, sponsor, active |
| `projects` | projet | id, name, programme_id, site_id, governance_level, method, phase, gate, start_date, finish_date, baseline_finish, budget, contingency, contingency_used, health_override, closed, pir_on, pir_verdict |
| `milestones` | jalon de plan | id, project_id, name, kind (gate\|milestone), gate, due_date, base_date, done |
| `risks` | ligne RAID | id, project_id, kind (Risk\|Issue\|Assumption\|Dependency), title, probability (1-5), impact (1-5), status, response, owner_id, opened_on, review_on, origin_site |
| `cost_lines` | écriture du grand livre (en ajout seul — une correction est une contre-passation) | id, project_id, period (AAAA-MM), booked_on, amount, category, from_contingency, kind (capex\|opex), currency, fx_rate, amount_local |
| `commitments` | engagement (bon de commande) | id, project_id, reference, supplier, amount, currency, fx_rate, kind, raised_on, expected_on, status |
| `benefits` | bénéfice promis | id, project_id, kind, title, measure, unit, baseline, target, actual (dans l'unité PROPRE du bénéfice, jamais en devise), realise_on, measured_on, status |
| `timesheets` | semaine × personne × projet | id, project_id, person_id, week_start, days |
| `lessons` | enseignement | id, project_id (peut être NUL : l'enseignement survit au projet), programme_id, site_id, gate_n, category, title, outcome (Positive\|Negative), recommendation, status, raised_on, adopted_on |
| `tolerances` | marge accordée (l'historique entier ; `active` marque la courante) | id, project_id, schedule_days, cost_pct, benefit_pct, set_on, active |
| `exceptions` | dépassement constaté | id, project_id, dimension (schedule\|cost\|benefit), raised_on, measured, allowed (figés au constat), status, answer_kind, answered_on |
| `business_cases` | cas d'affaire (un par projet) | id, project_id, expected_cost, expected_benefit, written_on, updated_on, reconfirmed_gate, reconfirmed_on |
| `decisions` | décision de gouvernance | id, at, user_label, action, entity, entity_id, detail — filtrée sur les libellés exacts que les routes écrivent |

## La règle de stabilité

Ajouter une colonne ou une vue : changement MINEUR. Retirer, renommer,
changer le sens d'une colonne : **MAJEUR**, annoncé au CHANGELOG avant
livraison. Un test (`server/test/reporting.test.js`) tient la
correspondance entre ce document et le schéma réel : une vue non
documentée ou une vue documentée absente échoue la construction.
