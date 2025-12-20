import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import { organizationsApi, type OrganizationMember } from '../../api/organizations';
import * as crmApi from '../../api/crm';
import {
  crmAutomationsApi,
  type CrmAutomationAssigneeTarget,
  type CrmAutomationStageSequenceRule,
  type CrmAutomationStageTaskRule,
  type CrmAutomationStaleDealRule,
  type CrmAutomationWonChecklistRule,
} from '../../api/crm-automations';

type Option = { id: string; label: string };

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const normalizeTarget = (value: unknown): CrmAutomationAssigneeTarget => {
  if (value === 'owner' || value === 'mover' || value === 'specific') return value;
  return 'owner';
};

export default function CrmAutomationsSettingsTab() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'tr').toLowerCase().slice(0, 2);

  const text = useMemo(() => {
    const tr = {
      title: 'Otomasyon',
      subtitle: 'CRM otomasyon kurallarını yönetin.',
      refresh: 'Yenile',
      loading: 'Yükleniyor…',
      errorPrefix: 'Hata:',
      validation: {
        requiredField: (fieldLabel: string) => `${fieldLabel} zorunlu`,
      },
      sections: {
        stage: { title: 'Stage → Otomatik Görev', new: 'Yeni kural' },
        sequence: { title: 'Stage → Sıralı Görev Akışı', new: 'Yeni kural' },
        stale: { title: 'Stale Deal → Hatırlatma Görevi', new: 'Yeni kural' },
        won: { title: 'Won → Follow-up Checklist', new: 'Yeni kural' },
      },
      fields: {
        enabled: 'Aktif',
        fromStage: 'Başlangıç stage',
        toStage: 'Hedef stage',
        any: 'Hepsi',
        titleTemplate: 'Görev başlığı şablonu',
        sequenceItems: 'Sequence adımları (satır: gün|başlık)',
        dueInDays: 'Vade (gün)',
        staleDays: 'Stale (gün)',
        stageFilter: 'Stage filtresi',
        cooldownDays: 'Cooldown (gün)',
        checklistItems: 'Checklist (satır başına bir görev)',
        assigneeTarget: 'Atama',
        assigneeUserId: 'Kullanıcı',
      },
      targets: {
        owner: 'Deal sahibi',
        mover: 'İşlemi yapan',
        specific: 'Belirli kullanıcı',
      },
      actions: {
        edit: 'Düzenle',
        cancel: 'İptal',
        save: 'Kaydet',
        create: 'Oluştur',
      },
      hints: {
        stageTemplate: 'Örn: Auto task: {{toStageName}}',
        sequenceItems: 'Örn:\n3|Ara ({{opportunityName}})\n7|E-posta gönder ({{toStageName}})',
        staleTemplate: 'Örn: Stale task: {{opportunityName}}',
        wonItems: 'Örn:\nMüşteriye teşekkür e-postası gönder\nOnboarding toplantısı planla',
      },
    };

    const en = {
      title: 'Automations',
      subtitle: 'Manage CRM automation rules.',
      refresh: 'Refresh',
      loading: 'Loading…',
      errorPrefix: 'Error:',
      validation: {
        requiredField: (fieldLabel: string) => `${fieldLabel} is required`,
      },
      sections: {
        stage: { title: 'Stage → Create Task', new: 'New rule' },
        sequence: { title: 'Stage → Sequence', new: 'New rule' },
        stale: { title: 'Stale Deal → Reminder Task', new: 'New rule' },
        won: { title: 'WON → Follow-up Checklist', new: 'New rule' },
      },
      fields: {
        enabled: 'Enabled',
        fromStage: 'From stage',
        toStage: 'To stage',
        any: 'Any',
        titleTemplate: 'Task title template',
        sequenceItems: 'Sequence steps (line: days|title)',
        dueInDays: 'Due in days',
        staleDays: 'Stale days',
        stageFilter: 'Stage filter',
        cooldownDays: 'Cooldown days',
        checklistItems: 'Checklist (one task per line)',
        assigneeTarget: 'Assignee',
        assigneeUserId: 'User',
      },
      targets: {
        owner: 'Deal owner',
        mover: 'Actor (runner)',
        specific: 'Specific user',
      },
      actions: {
        edit: 'Edit',
        cancel: 'Cancel',
        save: 'Save',
        create: 'Create',
      },
      hints: {
        stageTemplate: 'e.g. Auto task: {{toStageName}}',
        sequenceItems: 'e.g.\n3|Call ({{opportunityName}})\n7|Send email ({{toStageName}})',
        staleTemplate: 'e.g. Stale task: {{opportunityName}}',
        wonItems: 'e.g.\nSend thank-you email\nSchedule onboarding call',
      },
    };

    const fr = {
      title: 'Automatisations',
      subtitle: 'Gérez les règles d’automatisation CRM.',
      refresh: 'Actualiser',
      loading: 'Chargement…',
      errorPrefix: 'Erreur :',
      validation: {
        requiredField: (fieldLabel: string) => `${fieldLabel} est requis`,
      },
      sections: {
        stage: { title: 'Étape → Créer une tâche', new: 'Nouvelle règle' },
        sequence: { title: 'Étape → Séquence', new: 'Nouvelle règle' },
        stale: { title: 'Deal inactif → Tâche de rappel', new: 'Nouvelle règle' },
        won: { title: 'Gagné → Checklist de suivi', new: 'Nouvelle règle' },
      },
      fields: {
        enabled: 'Actif',
        fromStage: 'Étape source',
        toStage: 'Étape cible',
        any: 'Tous',
        titleTemplate: 'Modèle de titre de tâche',
        sequenceItems: 'Étapes de séquence (ligne : jours|titre)',
        dueInDays: 'Échéance (jours)',
        staleDays: 'Inactivité (jours)',
        stageFilter: 'Filtre d’étape',
        cooldownDays: 'Cooldown (jours)',
        checklistItems: 'Checklist (une tâche par ligne)',
        assigneeTarget: 'Attribution',
        assigneeUserId: 'Utilisateur',
      },
      targets: {
        owner: 'Propriétaire du deal',
        mover: 'Exécutant (acteur)',
        specific: 'Utilisateur spécifique',
      },
      actions: {
        edit: 'Modifier',
        cancel: 'Annuler',
        save: 'Enregistrer',
        create: 'Créer',
      },
      hints: {
        stageTemplate: 'ex. Tâche auto : {{toStageName}}',
        sequenceItems: 'ex.\n3|Appeler ({{opportunityName}})\n7|Envoyer un e-mail ({{toStageName}})',
        staleTemplate: 'ex. Tâche inactive : {{opportunityName}}',
        wonItems: 'ex.\nEnvoyer un e-mail de remerciement\nPlanifier un appel d’onboarding',
      },
    };

    const de = {
      title: 'Automatisierungen',
      subtitle: 'CRM-Automatisierungsregeln verwalten.',
      refresh: 'Aktualisieren',
      loading: 'Wird geladen…',
      errorPrefix: 'Fehler:',
      validation: {
        requiredField: (fieldLabel: string) => `${fieldLabel} ist erforderlich`,
      },
      sections: {
        stage: { title: 'Phase → Aufgabe erstellen', new: 'Neue Regel' },
        sequence: { title: 'Phase → Sequenz', new: 'Neue Regel' },
        stale: { title: 'Stale Deal → Erinnerungsaufgabe', new: 'Neue Regel' },
        won: { title: 'Gewonnen → Follow-up-Checkliste', new: 'Neue Regel' },
      },
      fields: {
        enabled: 'Aktiv',
        fromStage: 'Von Phase',
        toStage: 'Zu Phase',
        any: 'Alle',
        titleTemplate: 'Aufgabentitel-Vorlage',
        sequenceItems: 'Sequenz-Schritte (Zeile: Tage|Titel)',
        dueInDays: 'Fällig in Tagen',
        staleDays: 'Stale Tage',
        stageFilter: 'Phasenfilter',
        cooldownDays: 'Cooldown Tage',
        checklistItems: 'Checkliste (eine Aufgabe pro Zeile)',
        assigneeTarget: 'Zuweisung',
        assigneeUserId: 'Benutzer',
      },
      targets: {
        owner: 'Deal-Besitzer',
        mover: 'Ausführender (Akteur)',
        specific: 'Bestimmter Benutzer',
      },
      actions: {
        edit: 'Bearbeiten',
        cancel: 'Abbrechen',
        save: 'Speichern',
        create: 'Erstellen',
      },
      hints: {
        stageTemplate: 'z.B. Auto-Aufgabe: {{toStageName}}',
        sequenceItems: 'z.B.\n3|Anrufen ({{opportunityName}})\n7|E-Mail senden ({{toStageName}})',
        staleTemplate: 'z.B. Stale-Aufgabe: {{opportunityName}}',
        wonItems: 'z.B.\nDankes-E-Mail senden\nOnboarding-Call planen',
      },
    };

    if (lang === 'tr') return tr;
    if (lang === 'fr') return fr;
    if (lang === 'de') return de;
    return en;
  }, [lang]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stages, setStages] = useState<crmApi.CrmStage[]>([]);
  const stageOptions: Option[] = useMemo(
    () => (Array.isArray(stages) ? stages : []).map((s) => ({ id: s.id, label: s.name })),
    [stages],
  );
  const stageNameById = useMemo(() => {
    return new Map(stageOptions.map((s) => [s.id, s.label] as const));
  }, [stageOptions]);

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const memberOptions: Option[] = useMemo(() => {
    return (Array.isArray(members) ? members : []).map((m) => ({
      id: m.user.id,
      label: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email,
    }));
  }, [members]);

  const [stageRules, setStageRules] = useState<CrmAutomationStageTaskRule[]>([]);
  const [sequenceRules, setSequenceRules] = useState<CrmAutomationStageSequenceRule[]>([]);
  const [staleRules, setStaleRules] = useState<CrmAutomationStaleDealRule[]>([]);
  const [wonRules, setWonRules] = useState<CrmAutomationWonChecklistRule[]>([]);

  const [editingStageRuleId, setEditingStageRuleId] = useState<string | null>(null);
  const [stageForm, setStageForm] = useState({
    enabled: true,
    fromStageId: '' as string,
    toStageId: '' as string,
    titleTemplate: 'Auto task: {{toStageName}}',
    dueInDays: 3,
    assigneeTarget: 'owner' as CrmAutomationAssigneeTarget,
    assigneeUserId: '' as string,
  });

  const [editingSequenceRuleId, setEditingSequenceRuleId] = useState<string | null>(null);
  const [sequenceForm, setSequenceForm] = useState({
    enabled: true,
    fromStageId: '' as string,
    toStageId: '' as string,
    itemsText: '' as string,
    assigneeTarget: 'owner' as CrmAutomationAssigneeTarget,
    assigneeUserId: '' as string,
  });

  const [editingStaleRuleId, setEditingStaleRuleId] = useState<string | null>(null);
  const [staleForm, setStaleForm] = useState({
    enabled: true,
    staleDays: 30,
    stageId: '' as string,
    titleTemplate: 'Stale task: {{opportunityName}}',
    dueInDays: 0,
    cooldownDays: 7,
    assigneeTarget: 'owner' as CrmAutomationAssigneeTarget,
    assigneeUserId: '' as string,
  });

  const [editingWonRuleId, setEditingWonRuleId] = useState<string | null>(null);
  const [wonForm, setWonForm] = useState({
    enabled: true,
    titleTemplatesText: '' as string,
    dueInDays: 0,
    assigneeTarget: 'owner' as CrmAutomationAssigneeTarget,
    assigneeUserId: '' as string,
  });

  const resetStageForm = () => {
    setEditingStageRuleId(null);
    setStageForm({
      enabled: true,
      fromStageId: '',
      toStageId: stageOptions[0]?.id || '',
      titleTemplate: 'Auto task: {{toStageName}}',
      dueInDays: 3,
      assigneeTarget: 'owner',
      assigneeUserId: '',
    });
  };

  const resetStaleForm = () => {
    setEditingStaleRuleId(null);
    setStaleForm({
      enabled: true,
      staleDays: 30,
      stageId: '',
      titleTemplate: 'Stale task: {{opportunityName}}',
      dueInDays: 0,
      cooldownDays: 7,
      assigneeTarget: 'owner',
      assigneeUserId: '',
    });
  };

  const resetSequenceForm = () => {
    setEditingSequenceRuleId(null);
    setSequenceForm({
      enabled: true,
      fromStageId: '',
      toStageId: stageOptions[0]?.id || '',
      itemsText: '',
      assigneeTarget: 'owner',
      assigneeUserId: '',
    });
  };

  const resetWonForm = () => {
    setEditingWonRuleId(null);
    setWonForm({
      enabled: true,
      titleTemplatesText: '',
      dueInDays: 0,
      assigneeTarget: 'owner',
      assigneeUserId: '',
    });
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stagesRes, stageRulesRes, sequenceRulesRes, staleRulesRes, wonRulesRes] = await Promise.all([
        crmApi.getStages(),
        crmAutomationsApi.listStageTaskRules(),
        crmAutomationsApi.listStageSequenceRules(),
        crmAutomationsApi.listStaleDealRules(),
        crmAutomationsApi.listWonChecklistRules(),
      ]);

      setStages(Array.isArray(stagesRes) ? stagesRes : []);
      setStageRules(Array.isArray(stageRulesRes?.items) ? stageRulesRes.items : []);
      setSequenceRules(Array.isArray(sequenceRulesRes?.items) ? sequenceRulesRes.items : []);
      setStaleRules(Array.isArray(staleRulesRes?.items) ? staleRulesRes.items : []);
      setWonRules(Array.isArray(wonRulesRes?.items) ? wonRulesRes.items : []);

      try {
        const orgs = await organizationsApi.getAll();
        const orgId = orgs?.[0]?.id;
        if (orgId) {
          const mem = await organizationsApi.getMembers(orgId);
          setMembers(Array.isArray(mem) ? mem : []);
        }
      } catch {
        setMembers([]);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    // stage list geldikten sonra defaults
    if (stageOptions.length > 0) {
      setStageForm((prev) => (prev.toStageId ? prev : { ...prev, toStageId: stageOptions[0]?.id || '' }));
      setSequenceForm((prev) => (prev.toStageId ? prev : { ...prev, toStageId: stageOptions[0]?.id || '' }));
    }
  }, [stageOptions.length]);

  const startEditStageRule = (rule: CrmAutomationStageTaskRule) => {
    setEditingStageRuleId(rule.id);
    setStageForm({
      enabled: !!rule.enabled,
      fromStageId: rule.fromStageId || '',
      toStageId: rule.toStageId || '',
      titleTemplate: rule.titleTemplate || '',
      dueInDays: clampInt(rule.dueInDays, 0, 0, 3650),
      assigneeTarget: normalizeTarget(rule.assigneeTarget),
      assigneeUserId: rule.assigneeUserId || '',
    });
  };

  const parseSequenceItemsText = (textValue: string): Array<{ titleTemplate: string; dueInDays: number }> => {
    const lines = String(textValue || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    return lines
      .map((line) => {
        const m = line.match(/^\s*(\d+)\s*\|\s*(.+)$/);
        if (m) {
          return {
            dueInDays: clampInt(m[1], 0, 0, 3650),
            titleTemplate: String(m[2] || '').trim(),
          };
        }
        return { dueInDays: 0, titleTemplate: line };
      })
      .filter((it) => Boolean(String(it.titleTemplate || '').trim()));
  };

  const startEditSequenceRule = (rule: CrmAutomationStageSequenceRule) => {
    setEditingSequenceRuleId(rule.id);
    const itemsText = Array.isArray(rule.items)
      ? rule.items
          .map((it) => {
            const dueInDays = clampInt((it as any)?.dueInDays, 0, 0, 3650);
            const titleTemplate = String((it as any)?.titleTemplate || '').trim();
            if (!titleTemplate) return '';
            return `${dueInDays}|${titleTemplate}`;
          })
          .filter(Boolean)
          .join('\n')
      : '';

    setSequenceForm({
      enabled: !!rule.enabled,
      fromStageId: rule.fromStageId || '',
      toStageId: rule.toStageId || '',
      itemsText,
      assigneeTarget: normalizeTarget(rule.assigneeTarget),
      assigneeUserId: rule.assigneeUserId || '',
    });
  };

  const startEditStaleRule = (rule: CrmAutomationStaleDealRule) => {
    setEditingStaleRuleId(rule.id);
    setStaleForm({
      enabled: !!rule.enabled,
      staleDays: clampInt(rule.staleDays, 30, 0, 3650),
      stageId: rule.stageId || '',
      titleTemplate: rule.titleTemplate || '',
      dueInDays: clampInt(rule.dueInDays, 0, 0, 3650),
      cooldownDays: clampInt(rule.cooldownDays, 7, 0, 3650),
      assigneeTarget: normalizeTarget(rule.assigneeTarget),
      assigneeUserId: rule.assigneeUserId || '',
    });
  };

  const startEditWonRule = (rule: CrmAutomationWonChecklistRule) => {
    setEditingWonRuleId(rule.id);
    setWonForm({
      enabled: !!rule.enabled,
      titleTemplatesText: Array.isArray(rule.titleTemplates)
        ? rule.titleTemplates.join('\n')
        : '',
      dueInDays: clampInt(rule.dueInDays, 0, 0, 3650),
      assigneeTarget: normalizeTarget(rule.assigneeTarget),
      assigneeUserId: rule.assigneeUserId || '',
    });
  };

  const saveStageRule = async () => {
    setError(null);

    const toStageId = String(stageForm.toStageId || '').trim();
    const titleTemplate = String(stageForm.titleTemplate || '').trim();
    const assigneeTarget = normalizeTarget(stageForm.assigneeTarget);

    if (!toStageId) {
      setError(text.validation.requiredField(text.fields.toStage));
      return;
    }
    if (!titleTemplate) {
      setError(text.validation.requiredField(text.fields.titleTemplate));
      return;
    }
    if (assigneeTarget === 'specific' && !stageForm.assigneeUserId) {
      setError(text.validation.requiredField(text.fields.assigneeUserId));
      return;
    }

    const payload = {
      enabled: !!stageForm.enabled,
      fromStageId: stageForm.fromStageId ? String(stageForm.fromStageId) : null,
      toStageId,
      titleTemplate,
      dueInDays: clampInt(stageForm.dueInDays, 0, 0, 3650),
      assigneeTarget,
      assigneeUserId: assigneeTarget === 'specific' ? String(stageForm.assigneeUserId) : null,
    };

    try {
      if (editingStageRuleId) {
        await crmAutomationsApi.updateStageTaskRule(editingStageRuleId, payload);
      } else {
        await crmAutomationsApi.createStageTaskRule(payload);
      }
      await loadAll();
      resetStageForm();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const saveSequenceRule = async () => {
    setError(null);

    const toStageId = String(sequenceForm.toStageId || '').trim();
    const assigneeTarget = normalizeTarget(sequenceForm.assigneeTarget);
    const items = parseSequenceItemsText(sequenceForm.itemsText);

    if (!toStageId) {
      setError(text.validation.requiredField(text.fields.toStage));
      return;
    }
    if (!items.length) {
      setError(text.validation.requiredField(text.fields.sequenceItems));
      return;
    }
    if (assigneeTarget === 'specific' && !sequenceForm.assigneeUserId) {
      setError(text.validation.requiredField(text.fields.assigneeUserId));
      return;
    }

    const payload = {
      enabled: !!sequenceForm.enabled,
      fromStageId: sequenceForm.fromStageId ? String(sequenceForm.fromStageId) : null,
      toStageId,
      items,
      assigneeTarget,
      assigneeUserId: assigneeTarget === 'specific' ? String(sequenceForm.assigneeUserId) : null,
    };

    try {
      if (editingSequenceRuleId) {
        await crmAutomationsApi.updateStageSequenceRule(editingSequenceRuleId, payload);
      } else {
        await crmAutomationsApi.createStageSequenceRule(payload);
      }
      await loadAll();
      resetSequenceForm();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const saveStaleRule = async () => {
    setError(null);

    const titleTemplate = String(staleForm.titleTemplate || '').trim();
    const assigneeTarget = normalizeTarget(staleForm.assigneeTarget);

    if (!titleTemplate) {
      setError(text.validation.requiredField(text.fields.titleTemplate));
      return;
    }
    if (assigneeTarget === 'specific' && !staleForm.assigneeUserId) {
      setError(text.validation.requiredField(text.fields.assigneeUserId));
      return;
    }

    const payload = {
      enabled: !!staleForm.enabled,
      staleDays: clampInt(staleForm.staleDays, 30, 0, 3650),
      stageId: staleForm.stageId ? String(staleForm.stageId) : null,
      titleTemplate,
      dueInDays: clampInt(staleForm.dueInDays, 0, 0, 3650),
      cooldownDays: clampInt(staleForm.cooldownDays, 7, 0, 3650),
      assigneeTarget,
      assigneeUserId: assigneeTarget === 'specific' ? String(staleForm.assigneeUserId) : null,
    };

    try {
      if (editingStaleRuleId) {
        await crmAutomationsApi.updateStaleDealRule(editingStaleRuleId, payload);
      } else {
        await crmAutomationsApi.createStaleDealRule(payload);
      }
      await loadAll();
      resetStaleForm();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const saveWonRule = async () => {
    setError(null);

    const assigneeTarget = normalizeTarget(wonForm.assigneeTarget);
    const titleTemplates = String(wonForm.titleTemplatesText || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!titleTemplates.length) {
      setError(text.validation.requiredField(text.fields.checklistItems));
      return;
    }
    if (assigneeTarget === 'specific' && !wonForm.assigneeUserId) {
      setError(text.validation.requiredField(text.fields.assigneeUserId));
      return;
    }

    const payload = {
      enabled: !!wonForm.enabled,
      titleTemplates,
      dueInDays: clampInt(wonForm.dueInDays, 0, 0, 3650),
      assigneeTarget,
      assigneeUserId: assigneeTarget === 'specific' ? String(wonForm.assigneeUserId) : null,
    };

    try {
      if (editingWonRuleId) {
        await crmAutomationsApi.updateWonChecklistRule(editingWonRuleId, payload);
      } else {
        await crmAutomationsApi.createWonChecklistRule(payload);
      }
      await loadAll();
      resetWonForm();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const toggleStageRuleEnabled = async (rule: CrmAutomationStageTaskRule) => {
    try {
      await crmAutomationsApi.updateStageTaskRule(rule.id, { enabled: !rule.enabled });
      await loadAll();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const toggleSequenceRuleEnabled = async (rule: CrmAutomationStageSequenceRule) => {
    try {
      await crmAutomationsApi.updateStageSequenceRule(rule.id, { enabled: !rule.enabled });
      await loadAll();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const toggleStaleRuleEnabled = async (rule: CrmAutomationStaleDealRule) => {
    try {
      await crmAutomationsApi.updateStaleDealRule(rule.id, { enabled: !rule.enabled });
      await loadAll();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const toggleWonRuleEnabled = async (rule: CrmAutomationWonChecklistRule) => {
    try {
      await crmAutomationsApi.updateWonChecklistRule(rule.id, { enabled: !rule.enabled });
      await loadAll();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-600">{text.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{text.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{text.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
            disabled={loading}
          >
            {text.refresh}
          </button>
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600">
            {text.errorPrefix} {error}
          </div>
        )}
      </div>

      {/* Stage change rules */}
      <div className="border rounded-xl bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-sm font-semibold text-gray-900">{text.sections.stage.title}</div>
          <button
            type="button"
            onClick={() => {
              if (editingStageRuleId) return;
              resetStageForm();
              setEditingStageRuleId('');
            }}
            className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
          >
            {text.sections.stage.new}
          </button>
        </div>

        {stageRules.length === 0 ? (
          <div className="text-sm text-gray-500">—</div>
        ) : (
          <div className="space-y-2">
            {stageRules.map((r) => (
              <div key={r.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {(r.fromStageId ? stageNameById.get(r.fromStageId) : text.fields.any) || text.fields.any}
                    {' → '}
                    {(stageNameById.get(r.toStageId) || r.toStageId) as string}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 break-words">
                    <div>{text.fields.titleTemplate}: {r.titleTemplate}</div>
                    <div>{text.fields.dueInDays}: {r.dueInDays ?? 0}</div>
                    <div>
                      {text.fields.assigneeTarget}: {(text.targets as any)[r.assigneeTarget] || r.assigneeTarget}
                      {r.assigneeTarget === 'specific' && r.assigneeUserId ? ` (${r.assigneeUserId})` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!r.enabled}
                      onChange={() => void toggleStageRuleEnabled(r)}
                    />
                    {text.fields.enabled}
                  </label>
                  <button
                    type="button"
                    onClick={() => startEditStageRule(r)}
                    className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {text.actions.edit}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(editingStageRuleId !== null) && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!stageForm.enabled}
                  onChange={(e) => setStageForm((p) => ({ ...p, enabled: e.target.checked }))}
                />
                {text.fields.enabled}
              </label>

              <div />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.fromStage}</label>
                <select
                  value={stageForm.fromStageId}
                  onChange={(e) => setStageForm((p) => ({ ...p, fromStageId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                >
                  <option value="">{text.fields.any}</option>
                  {stageOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.toStage}</label>
                <select
                  value={stageForm.toStageId}
                  onChange={(e) => setStageForm((p) => ({ ...p, toStageId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                >
                  <option value="">—</option>
                  {stageOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.titleTemplate}</label>
                <input
                  value={stageForm.titleTemplate}
                  onChange={(e) => setStageForm((p) => ({ ...p, titleTemplate: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                  placeholder={text.hints.stageTemplate}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.dueInDays}</label>
                <input
                  type="number"
                  min={0}
                  value={stageForm.dueInDays}
                  onChange={(e) => setStageForm((p) => ({ ...p, dueInDays: clampInt(e.target.value, 0, 0, 3650) }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.assigneeTarget}</label>
                <select
                  value={stageForm.assigneeTarget}
                  onChange={(e) => setStageForm((p) => ({ ...p, assigneeTarget: normalizeTarget(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                >
                  <option value="owner">{text.targets.owner}</option>
                  <option value="mover">{text.targets.mover}</option>
                  <option value="specific">{text.targets.specific}</option>
                </select>
              </div>

              {stageForm.assigneeTarget === 'specific' && (
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.assigneeUserId}</label>
                  <select
                    value={stageForm.assigneeUserId}
                    onChange={(e) => setStageForm((p) => ({ ...p, assigneeUserId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                  >
                    <option value="">—</option>
                    {memberOptions.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetStageForm();
                  setEditingStageRuleId(null);
                }}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {text.actions.cancel}
              </button>
              <button
                type="button"
                onClick={() => void saveStageRule()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
              >
                {editingStageRuleId ? text.actions.save : text.actions.create}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stage sequence rules */}
      <div className="border rounded-xl bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-sm font-semibold text-gray-900">{text.sections.sequence.title}</div>
          <button
            type="button"
            onClick={() => {
              if (editingSequenceRuleId) return;
              resetSequenceForm();
              setEditingSequenceRuleId('');
            }}
            className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
          >
            {text.sections.sequence.new}
          </button>
        </div>

        {sequenceRules.length === 0 ? (
          <div className="text-sm text-gray-500">—</div>
        ) : (
          <div className="space-y-2">
            {sequenceRules.map((r) => (
              <div key={r.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {text.fields.toStage}: {stageNameById.get(r.toStageId) || r.toStageId}
                    {r.fromStageId ? ` (${text.fields.fromStage}: ${stageNameById.get(r.fromStageId) || r.fromStageId})` : ''}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 break-words">
                    <div>
                      {text.fields.sequenceItems}: {Array.isArray(r.items) ? r.items.length : 0}
                    </div>
                    <div>
                      {text.fields.assigneeTarget}: {(text.targets as any)[r.assigneeTarget] || r.assigneeTarget}
                      {r.assigneeTarget === 'specific' && r.assigneeUserId ? ` (${r.assigneeUserId})` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!r.enabled}
                      onChange={() => void toggleSequenceRuleEnabled(r)}
                    />
                    {text.fields.enabled}
                  </label>
                  <button
                    type="button"
                    onClick={() => startEditSequenceRule(r)}
                    className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {text.actions.edit}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(editingSequenceRuleId !== null) && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!sequenceForm.enabled}
                  onChange={(e) => setSequenceForm((p) => ({ ...p, enabled: e.target.checked }))}
                />
                {text.fields.enabled}
              </label>

              <div />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.fromStage}</label>
                <select
                  value={sequenceForm.fromStageId}
                  onChange={(e) => setSequenceForm((p) => ({ ...p, fromStageId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                >
                  <option value="">{text.fields.any}</option>
                  {stageOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.toStage}</label>
                <select
                  value={sequenceForm.toStageId}
                  onChange={(e) => setSequenceForm((p) => ({ ...p, toStageId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                >
                  <option value="">—</option>
                  {stageOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.sequenceItems}</label>
                <textarea
                  value={sequenceForm.itemsText}
                  onChange={(e) => setSequenceForm((p) => ({ ...p, itemsText: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white min-h-[120px]"
                  placeholder={text.hints.sequenceItems}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.assigneeTarget}</label>
                <select
                  value={sequenceForm.assigneeTarget}
                  onChange={(e) => setSequenceForm((p) => ({ ...p, assigneeTarget: normalizeTarget(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                >
                  <option value="owner">{text.targets.owner}</option>
                  <option value="mover">{text.targets.mover}</option>
                  <option value="specific">{text.targets.specific}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.assigneeUserId}</label>
                <select
                  value={sequenceForm.assigneeUserId}
                  onChange={(e) => setSequenceForm((p) => ({ ...p, assigneeUserId: e.target.value }))}
                  disabled={sequenceForm.assigneeTarget !== 'specific'}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white disabled:bg-gray-50"
                >
                  <option value="">—</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetSequenceForm();
                  setEditingSequenceRuleId(null);
                }}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {text.actions.cancel}
              </button>
              <button
                type="button"
                onClick={() => void saveSequenceRule()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
              >
                {editingSequenceRuleId ? text.actions.save : text.actions.create}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stale deal rules */}
      <div className="border rounded-xl bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-sm font-semibold text-gray-900">{text.sections.stale.title}</div>
          <button
            type="button"
            onClick={() => {
              if (editingStaleRuleId) return;
              resetStaleForm();
              setEditingStaleRuleId('');
            }}
            className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
          >
            {text.sections.stale.new}
          </button>
        </div>

        {staleRules.length === 0 ? (
          <div className="text-sm text-gray-500">—</div>
        ) : (
          <div className="space-y-2">
            {staleRules.map((r) => (
              <div key={r.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {text.fields.staleDays}: {r.staleDays} — {text.fields.stageFilter}:{' '}
                    {(r.stageId ? (stageNameById.get(r.stageId) || r.stageId) : text.fields.any) as string}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 break-words">
                    <div>{text.fields.titleTemplate}: {r.titleTemplate}</div>
                    <div>{text.fields.dueInDays}: {r.dueInDays ?? 0}</div>
                    <div>{text.fields.cooldownDays}: {r.cooldownDays ?? 0}</div>
                    <div>
                      {text.fields.assigneeTarget}: {(text.targets as any)[r.assigneeTarget] || r.assigneeTarget}
                      {r.assigneeTarget === 'specific' && r.assigneeUserId ? ` (${r.assigneeUserId})` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!r.enabled}
                      onChange={() => void toggleStaleRuleEnabled(r)}
                    />
                    {text.fields.enabled}
                  </label>
                  <button
                    type="button"
                    onClick={() => startEditStaleRule(r)}
                    className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {text.actions.edit}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(editingStaleRuleId !== null) && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!staleForm.enabled}
                  onChange={(e) => setStaleForm((p) => ({ ...p, enabled: e.target.checked }))}
                />
                {text.fields.enabled}
              </label>

              <div />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.staleDays}</label>
                <input
                  type="number"
                  min={0}
                  value={staleForm.staleDays}
                  onChange={(e) => setStaleForm((p) => ({ ...p, staleDays: clampInt(e.target.value, 30, 0, 3650) }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.stageFilter}</label>
                <select
                  value={staleForm.stageId}
                  onChange={(e) => setStaleForm((p) => ({ ...p, stageId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                >
                  <option value="">{text.fields.any}</option>
                  {stageOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.titleTemplate}</label>
                <input
                  value={staleForm.titleTemplate}
                  onChange={(e) => setStaleForm((p) => ({ ...p, titleTemplate: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                  placeholder={text.hints.staleTemplate}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.dueInDays}</label>
                <input
                  type="number"
                  min={0}
                  value={staleForm.dueInDays}
                  onChange={(e) => setStaleForm((p) => ({ ...p, dueInDays: clampInt(e.target.value, 0, 0, 3650) }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.cooldownDays}</label>
                <input
                  type="number"
                  min={0}
                  value={staleForm.cooldownDays}
                  onChange={(e) => setStaleForm((p) => ({ ...p, cooldownDays: clampInt(e.target.value, 7, 0, 3650) }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.assigneeTarget}</label>
                <select
                  value={staleForm.assigneeTarget}
                  onChange={(e) => setStaleForm((p) => ({ ...p, assigneeTarget: normalizeTarget(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                >
                  <option value="owner">{text.targets.owner}</option>
                  <option value="mover">{text.targets.mover}</option>
                  <option value="specific">{text.targets.specific}</option>
                </select>
              </div>

              {staleForm.assigneeTarget === 'specific' && (
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.assigneeUserId}</label>
                  <select
                    value={staleForm.assigneeUserId}
                    onChange={(e) => setStaleForm((p) => ({ ...p, assigneeUserId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                  >
                    <option value="">—</option>
                    {memberOptions.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetStaleForm();
                  setEditingStaleRuleId(null);
                }}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {text.actions.cancel}
              </button>
              <button
                type="button"
                onClick={() => void saveStaleRule()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
              >
                {editingStaleRuleId ? text.actions.save : text.actions.create}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Won checklist rules */}
      <div className="border rounded-xl bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-sm font-semibold text-gray-900">{text.sections.won.title}</div>
          <button
            type="button"
            onClick={() => {
              if (editingWonRuleId) return;
              resetWonForm();
              setEditingWonRuleId('');
            }}
            className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
          >
            {text.sections.won.new}
          </button>
        </div>

        {wonRules.length === 0 ? (
          <div className="text-sm text-gray-500">—</div>
        ) : (
          <div className="space-y-2">
            {wonRules.map((r) => (
              <div key={r.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {text.fields.checklistItems}: {Array.isArray(r.titleTemplates) ? r.titleTemplates.length : 0}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 break-words">
                    <div>{text.fields.dueInDays}: {r.dueInDays ?? 0}</div>
                    <div>
                      {text.fields.assigneeTarget}: {(text.targets as any)[r.assigneeTarget] || r.assigneeTarget}
                      {r.assigneeTarget === 'specific' && r.assigneeUserId ? ` (${r.assigneeUserId})` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!r.enabled}
                      onChange={() => void toggleWonRuleEnabled(r)}
                    />
                    {text.fields.enabled}
                  </label>
                  <button
                    type="button"
                    onClick={() => startEditWonRule(r)}
                    className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {text.actions.edit}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(editingWonRuleId !== null) && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!wonForm.enabled}
                  onChange={(e) => setWonForm((p) => ({ ...p, enabled: e.target.checked }))}
                />
                {text.fields.enabled}
              </label>

              <div />

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.checklistItems}</label>
                <textarea
                  value={wonForm.titleTemplatesText}
                  onChange={(e) => setWonForm((p) => ({ ...p, titleTemplatesText: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white min-h-[120px]"
                  placeholder={text.hints.wonItems}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.dueInDays}</label>
                <input
                  type="number"
                  min={0}
                  value={wonForm.dueInDays}
                  onChange={(e) => setWonForm((p) => ({ ...p, dueInDays: clampInt(e.target.value, 0, 0, 3650) }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.assigneeTarget}</label>
                <select
                  value={wonForm.assigneeTarget}
                  onChange={(e) => setWonForm((p) => ({ ...p, assigneeTarget: normalizeTarget(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                >
                  <option value="owner">{text.targets.owner}</option>
                  <option value="mover">{text.targets.mover}</option>
                  <option value="specific">{text.targets.specific}</option>
                </select>
              </div>

              {wonForm.assigneeTarget === 'specific' && (
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{text.fields.assigneeUserId}</label>
                  <select
                    value={wonForm.assigneeUserId}
                    onChange={(e) => setWonForm((p) => ({ ...p, assigneeUserId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
                  >
                    <option value="">—</option>
                    {memberOptions.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetWonForm();
                  setEditingWonRuleId(null);
                }}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {text.actions.cancel}
              </button>
              <button
                type="button"
                onClick={() => void saveWonRule()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
              >
                {editingWonRuleId ? text.actions.save : text.actions.create}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
