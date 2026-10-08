import type { LeadConfig } from '../../../types/index.ts';
import { Section, Field, ListEditor, TableEditor, inputCls } from './fields.tsx';

/** Regles communes du Chef d'edition web (agent.md). */
export function LeadRulesForm({ cfg, onChange }: { cfg: LeadConfig; onChange: (cfg: LeadConfig) => void }) {
  const set = <K extends keyof LeadConfig>(key: K, value: LeadConfig[K]) => onChange({ ...cfg, [key]: value });
  return (
    <div className="space-y-5">
      <Section title="Publication">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Statut WordPress">
            <select className={inputCls} value={cfg.wpStatus} onChange={(e) => set('wpStatus', e.target.value as LeadConfig['wpStatus'])}>
              <option value="pending">En attente de relecture (pending)</option>
              <option value="draft">Brouillon (draft)</option>
            </select>
          </Field>
          <Field label="Éditeur"><input className={inputCls} value="Classique (jamais de blocs Gutenberg)" disabled /></Field>
        </div>
      </Section>

      <Section title="Interdits absolus" hint="Valables pour tous les agents, sans exception : ils priment sur les fiches.">
        <ListEditor items={cfg.forbidden} onChange={(v) => set('forbidden', v)} placeholder="Ajouter un interdit" multiline />
      </Section>

      <Section title="Comptes auteurs WordPress" hint="Signature dans la livraison → ID du compte WordPress. Vide = compte rs_delivery + alerte.">
        <TableEditor rows={cfg.authors} onChange={(v) => set('authors', v)} addLabel="Ajouter un auteur" empty={{ name: '', wpId: null }}
          columns={[{ key: 'name', label: 'Journaliste' }, { key: 'wpId', label: 'ID WordPress', type: 'number', width: '30%' }]} />
      </Section>

      <Section title="Catégories WordPress" hint="Table de référence : les agents choisissent leurs catégories dans cette liste.">
        <TableEditor rows={cfg.categoryIds} onChange={(v) => set('categoryIds', v as LeadConfig['categoryIds'])} addLabel="Ajouter une catégorie"
          empty={{ name: '', id: 0 }}
          columns={[{ key: 'name', label: 'Catégorie' }, { key: 'id', label: 'ID', type: 'number', width: '30%' }]} />
      </Section>

      <Section title="Formats HTML communs">
        <TableEditor rows={cfg.htmlFormats} onChange={(v) => set('htmlFormats', v)} addLabel="Ajouter un format" empty={{ element: '', format: '' }}
          columns={[{ key: 'element', label: 'Élément', width: '30%' }, { key: 'format', label: 'Format exact' }]} />
      </Section>

      <Section title="Contrôle final (bloquant)" hint="Un seul échec = article non créé, et le rapport liste les écarts.">
        <ListEditor items={cfg.finalChecks} onChange={(v) => set('finalChecks', v)} placeholder="Ajouter un contrôle" multiline />
      </Section>

      <Section title="Rapport de traitement">
        <input className={inputCls} value={cfg.reportFormat} onChange={(e) => set('reportFormat', e.target.value)} />
      </Section>
    </div>
  );
}
