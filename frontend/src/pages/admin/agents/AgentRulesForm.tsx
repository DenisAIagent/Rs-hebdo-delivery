import type { AgentConfig, AgentsResponse, EndBlock, HeadingRule } from '../../../types/index.ts';
import { Section, Field, NumberInput, ListEditor, OrderedChoices, TableEditor, inputCls } from './fields.tsx';

interface Props {
  cfg: AgentConfig;
  onChange: (cfg: AgentConfig) => void;
  meta: AgentsResponse['meta'];
  /** ID WordPress -> nom de categorie (table de l'agent principal). */
  categoryNames: Map<number, string>;
}

/** Formulaire structure des regles d'un agent de type de papier. */
export function AgentRulesForm({ cfg, onChange, meta, categoryNames }: Props) {
  const set = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => onChange({ ...cfg, [key]: value });
  const toggleCategory = (id: number) =>
    set('categories', cfg.categories.includes(id) ? cfg.categories.filter((c) => c !== id) : [...cfg.categories, id]);

  return (
    <div className="space-y-5">
      <Section title="Catégories WordPress" hint="Exactement ces catégories (cases à cocher issues de la table du Chef d'édition web).">
        <div className="flex flex-wrap gap-1.5">
          {[...categoryNames.entries()].map(([id, name]) => {
            const on = cfg.categories.includes(id);
            return (
              <button key={id} type="button" onClick={() => toggleCategory(id)}
                className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${on ? 'bg-rs-black text-white border-rs-black' : 'border-gray-300 text-gray-600 hover:border-rs-black'}`}>
                {name} <span className={on ? 'text-white/60' : 'text-gray-400'}>{id}</span>
              </button>
            );
          })}
          {cfg.categories.filter((id) => !categoryNames.has(id)).map((id) => (
            <button key={id} type="button" onClick={() => toggleCategory(id)} className="text-xs rounded-full px-2.5 py-1 border bg-amber-50 border-amber-300 text-amber-800">
              ID {id} (hors table) ✕
            </button>
          ))}
        </div>
      </Section>

      <Section title="Titre de l'article" hint="Accolades = éléments repris de la livraison, jamais inventés. Un modèle par cas (ex. BD, roman).">
        <TableEditor rows={cfg.titleTemplates} onChange={(v) => set('titleTemplates', v)} addLabel="Ajouter un modèle"
          empty={{ label: '', template: '' }}
          columns={[{ key: 'label', label: 'Cas', width: '25%' }, { key: 'template', label: 'Modèle' }]} />
      </Section>

      <Section title="Chapô" hint="Repris tel quel s'il est fourni par le journaliste. Sinon, chapô neutre généré tant que l'interrupteur « Chapô obligatoire » (Réglages) est coupé.">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Si le chapô manque">
            <select className={inputCls} value={cfg.chapo.ifMissing}
              onChange={(e) => set('chapo', { ...cfg.chapo, ifMissing: e.target.value as 'none' | 'generate' })}>
              <option value="generate">Chapô neutre généré</option>
              <option value="none">Aucun chapô + alerte</option>
            </select>
          </Field>
          <Field label="Mots max (alerte)"><NumberInput value={cfg.chapo.maxWords} min={5} placeholder="—" onChange={(v) => set('chapo', { ...cfg.chapo, maxWords: v })} /></Field>
          <Field label="Phrases max (alerte)"><NumberInput value={cfg.chapo.maxSentences} min={1} placeholder="—" onChange={(v) => set('chapo', { ...cfg.chapo, maxSentences: v })} /></Field>
        </div>
        {cfg.chapo.ifMissing === 'generate' && (
          <>
            <div className="mt-3">
              <Field label="Exemple de chapô (ton à imiter)" hint="Les noms, titres et chiffres du chapô généré doivent figurer dans la livraison, sinon il est écarté.">
                <textarea rows={2} className={inputCls} value={cfg.chapo.example ?? ''}
                  onChange={(e) => set('chapo', { ...cfg.chapo, example: e.target.value })} />
              </Field>
            </div>
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Un chapô généré n'est pas écrit par le journaliste : il n'apparaît que sur le web, jamais dans le docx Dropbox,
              et la génération s'arrête dès que l'interrupteur « Chapô obligatoire » est allumé.
            </p>
          </>
        )}
      </Section>

      <Section title="Corps de l'article" hint="Le texte du journaliste reste intégral, mot pour mot.">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Mise en page">
            <select className={inputCls} value={cfg.body.mode} onChange={(e) => set('body', { ...cfg.body, mode: e.target.value as AgentConfig['body']['mode'] })}>
              <option value="article">Un article par papier</option>
              <option value="groupe_hebdo">Un article groupé par numéro</option>
            </select>
          </Field>
          <Field label="Intertitres">
            <select className={inputCls} value={cfg.body.headings} onChange={(e) => set('body', { ...cfg.body, headings: e.target.value as HeadingRule })}>
              {(Object.keys(meta.headings) as HeadingRule[]).map((k) => <option key={k} value={k}>{meta.headings[k]}</option>)}
            </select>
          </Field>
          <Field label="Photos max dans le corps"><NumberInput value={cfg.body.photosMax} onChange={(v) => set('body', { ...cfg.body, photosMax: v ?? 0 })} /></Field>
          <Field label="Mots minimum entre deux photos"><NumberInput value={cfg.body.minWordsBetweenPhotos} placeholder="—" onChange={(v) => set('body', { ...cfg.body, minWordsBetweenPhotos: v })} /></Field>
        </div>
      </Section>

      <Section title="Image à la une">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Format">
            <select className={inputCls} value={cfg.featuredImage.format} onChange={(e) => set('featuredImage', { ...cfg.featuredImage, format: e.target.value as AgentConfig['featuredImage']['format'] })}>
              <option value="1280x853">1280 × 853</option>
              <option value="1000x1000">1000 × 1000 (carré)</option>
            </select>
          </Field>
          <Field label="Traitement">
            <select className={inputCls} value={cfg.featuredImage.crop} onChange={(e) => set('featuredImage', { ...cfg.featuredImage, crop: e.target.value as AgentConfig['featuredImage']['crop'] })}>
              <option value="recadrage_centre">Recadrage centré</option>
              <option value="entiere">Image entière, sans recadrage</option>
            </select>
          </Field>
          <Field label="Source"><input className={inputCls} value={cfg.featuredImage.source} onChange={(e) => set('featuredImage', { ...cfg.featuredImage, source: e.target.value })} /></Field>
          <Field label="Légende"><input className={inputCls} value={cfg.featuredImage.caption} placeholder="vide = aucune" onChange={(e) => set('featuredImage', { ...cfg.featuredImage, caption: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title="Fin d'article" hint="Éléments ajoutés après le texte, dans cet ordre, seulement s'ils sont fournis.">
        <OrderedChoices<EndBlock> value={cfg.endBlocks} onChange={(v) => set('endBlocks', v)} labels={meta.endBlocks} />
        <div className="mt-3">
          <Field label="Signature" hint="Ex. <em>Par {Prénom Nom}</em> — vide = pas de signature">
            <input className={inputCls} value={cfg.signature} onChange={(e) => set('signature', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Contrôles propres à ce type" hint="Vérifiés avant d'enregistrer l'article (en plus du contrôle final commun).">
        <ListEditor items={cfg.checks} onChange={(v) => set('checks', v)} placeholder="Ajouter un contrôle" />
      </Section>
    </div>
  );
}
