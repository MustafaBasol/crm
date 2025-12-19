import React from 'react';
import { FileText, Clock, CheckCircle, Shield, Users, Database } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { COMPANY_LEGAL } from '../../constants/companyLegal';

const DataProcessingAgreement: React.FC = () => {
  const { currentLanguage } = useLanguage();

  // Çoklu dil metinleri (TR/EN/DE/FR)
  const texts = {
    tr: {
      title: 'Veri İşleme Sözleşmesi (DPA)',
      subtitle: 'Comptario ile kullanıcılar arasındaki kişisel veri işleme sözleşmesi ve GDPR uyumluluk bilgileri',
      lastUpdated: 'Son güncelleme',
      overview: 'Genel Bakış',
      overviewText:
        'Bu Veri İşleme Sözleşmesi (DPA), Comptario hizmetlerini kullanan kullanıcılarımız ile aramızdaki kişisel veri işleme faaliyetlerini düzenler ve GDPR (Genel Veri Koruma Yönetmeliği) uyumluluğunu sağlar.',
      sections: {
        definitions: {
          title: 'Tanımlar',
          items: [
            {
              term: 'Veri Sorumlusu',
              definition:
                'Comptario hizmetlerini kullanan ve kişisel verilerin işlenme amaçlarını ve araçlarını belirleyen kuruluş.',
            },
            {
              term: 'Veri İşleyici',
              definition: 'Veri sorumlusu adına kişisel verileri işleyen Comptario şirketi.',
            },
            {
              term: 'Kişisel Veri',
              definition: 'Kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi.',
            },
            {
              term: 'İşleme',
              definition:
                'Kişisel veriler üzerinde gerçekleştirilen her türlü işlem (toplama, kaydetme, düzenleme, değiştirme, sorgulama, kullanma, aktarma, yaygınlaştırma, sınıflandırma, silme vb.).',
            },
          ],
        },
        processing: {
          title: 'Veri İşleme Detayları',
          categories: {
            title: 'İşlenen Veri Kategorileri',
            items: [
              'Kimlik bilgileri (ad, soyad, e-posta)',
              'İletişim bilgileri (telefon, adres)',
              'Finansal veriler (fatura bilgileri, ödeme kayıtları)',
              'İş verileri (hesap kayıtları, ürün bilgileri)',
              'Teknik veriler (IP adresi, kullanım kayıtları)',
            ],
          },
          purposes: {
            title: 'İşleme Amaçları',
            items: [
              'Muhasebe ve finansal hizmetlerin sağlanması',
              'Destek hizmetleri',
              'Sistem güvenliği ve performans optimizasyonu',
              'Yasal yükümlülüklerin yerine getirilmesi',
              'Hizmet geliştirme ve analiz',
            ],
          },
          subjects: {
            title: 'Veri Konusu Kategorileri',
            items: [
              'Kullanıcı temsilcileri',
              'Son kullanıcılar',
              'Tedarikçiler',
              'İş ortakları',
              'Web sitesi ziyaretçileri',
            ],
          },
        },
        obligations: {
          title: "Comptario'nun Yükümlülükleri",
          items: [
            'Kişisel verileri yalnızca kullanıcının talimatları doğrultusunda işleme',
            'Uygun teknik ve organizasyonel güvenlik önlemlerini uygulama',
            'Personel gizlilik yükümlülüklerini sağlama',
            'Alt işlemci kullanımında kullanıcı onayı alma',
            'Veri ihlallerini gecikmeksizin bildirme',
            'Veri konularının haklarını kullanmasına yardımcı olma',
            'Kullanıcının denetim haklarını destekleme',
          ],
        },
        security: {
          title: 'Güvenlik Önlemleri',
          items: [
            'Veri şifreleme (transit ve rest halinde)',
            'Erişim kontrolü ve kimlik doğrulama',
            'Düzenli güvenlik testleri ve penetrasyon testleri',
            'Personel güvenlik eğitimleri',
            'Olay müdahale prosedürleri',
            'Düzenli güvenlik güncellemeleri',
          ],
        },
        internationalTransfers: {
          title: 'Uluslararası Aktarımlar',
          content:
            'Kişisel veriler öncelikle AB/AEA içinde işlenir. Üçüncü ülkelere aktarım gerekirse, Aktarım Etki Değerlendirmesi yapılır ve Standart Sözleşme Hükümleri (SCCs) ile ek teknik/organizasyonel önlemler uygulanır.',
        },
        additionalSecurity: {
          title: 'Ek Güvenlik Tedbirleri',
          items: [
            'Mümkün olduğunda hesap verilerinin sahte/anonimleştirilmesi',
            'Ayrı üretim ve test ortamları',
            'Erişimlerin en az ayrıcalık ilkesine göre sınırlandırılması',
          ],
        },
        dataSubjects: {
          title: 'Veri Konusu Hakları',
          items: [
            'Bilgilendirilme hakkı',
            'Erişim hakkı',
            'Düzeltme hakkı',
            'Silme hakkı ("unutulma hakkı")',
            'İşlemeyi kısıtlama hakkı',
            'Veri taşınabilirliği hakkı',
            'İtiraz etme hakkı',
          ],
        },
        contact: {
          title: 'İletişim Bilgileri',
          dpo: 'Veri Koruma Sorumlusu',
          email: COMPANY_LEGAL.dataProtectionEmail || 'privacy@comptario.com',
          address: `${COMPANY_LEGAL.companyName}, ${COMPANY_LEGAL.address}`,
          phone: COMPANY_LEGAL.phone || '',
        },
      },
    },
    en: {
      title: 'Data Processing Agreement (DPA)',
      subtitle:
        'Personal data processing agreement between Comptario and service users and GDPR compliance information',
      lastUpdated: 'Last updated',
      overview: 'Overview',
      overviewText:
        'This Data Processing Agreement (DPA) governs the personal data processing activities between Comptario and users of our services, ensuring GDPR (General Data Protection Regulation) compliance.',
      sections: {
        definitions: {
          title: 'Definitions',
          items: [
            {
              term: 'Data Controller',
              definition:
                'The organization using Comptario services that determines the purposes and means of personal data processing.',
            },
            {
              term: 'Data Processor',
              definition: 'Comptario company that processes personal data on behalf of the data controller.',
            },
            {
              term: 'Personal Data',
              definition: 'Any information relating to an identified or identifiable natural person.',
            },
            {
              term: 'Processing',
              definition:
                'Any operation performed on personal data (collection, recording, organization, structuring, storage, adaptation, retrieval, consultation, use, disclosure, transmission, dissemination, alignment, combination, restriction, erasure, or destruction).',
            },
          ],
        },
        processing: {
          title: 'Data Processing Details',
          categories: {
            title: 'Categories of Personal Data',
            items: [
              'Identity information (name, surname, email)',
              'Contact information (phone, address)',
              'Financial data (invoice information, payment records)',
              'Business data (account records, product information)',
              'Technical data (IP address, usage logs)',
            ],
          },
          purposes: {
            title: 'Purposes of Processing',
            items: [
              'Providing accounting and financial services',
              'Support services',
              'System security and performance optimization',
              'Compliance with legal obligations',
              'Service development and analysis',
            ],
          },
          subjects: {
            title: 'Categories of Data Subjects',
            items: [
              'Account representatives',
              'End users',
              'Suppliers',
              'Business partners',
              'Website visitors',
            ],
          },
        },
        obligations: {
          title: "Comptario's Obligations",
          items: [
            'Process personal data only on data controller instructions',
            'Implement appropriate technical and organizational security measures',
            'Ensure staff confidentiality obligations',
            'Obtain data controller approval for sub-processor usage',
            'Notify data breaches without delay',
            'Assist with data subject rights exercises',
            'Support data controller audit rights',
          ],
        },
        security: {
          title: 'Security Measures',
          items: [
            'Data encryption (in transit and at rest)',
            'Access control and authentication',
            'Regular security testing and penetration tests',
            'Staff security training',
            'Incident response procedures',
            'Regular security updates',
          ],
        },
        internationalTransfers: {
          title: 'International Transfers',
          content:
            'Personal data is primarily processed within the EU/EEA. Where transfers to third countries occur, Transfer Impact Assessments are conducted and Standard Contractual Clauses (SCCs) plus supplementary technical/organizational measures are applied.',
        },
        additionalSecurity: {
          title: 'Additional Security Measures',
          items: [
            'Pseudonymization/Anonymization of account data when possible',
            'Separated production and test environments',
            'Least-privilege access controls enforced',
          ],
        },
        dataSubjects: {
          title: 'Data Subject Rights',
          items: [
            'Right to be informed',
            'Right of access',
            'Right to rectification',
            'Right to erasure ("right to be forgotten")',
            'Right to restrict processing',
            'Right to data portability',
            'Right to object',
          ],
        },
        contact: {
          title: 'Contact Information',
          dpo: 'Data Protection Officer',
          email: COMPANY_LEGAL.dataProtectionEmail || 'privacy@comptario.com',
          address: `${COMPANY_LEGAL.companyName}, ${COMPANY_LEGAL.address}`,
          phone: COMPANY_LEGAL.phone || '',
        },
      },
    },
    de: {
      title: 'Datenverarbeitungsvertrag (DPA)',
      subtitle:
        'Vereinbarung zur Verarbeitung personenbezogener Daten zwischen Comptario und Nutzern sowie DSGVO-Compliance-Informationen',
      lastUpdated: 'Zuletzt aktualisiert',
      overview: 'Überblick',
      overviewText:
        'Diese Vereinbarung über die Auftragsverarbeitung (DPA) regelt die Verarbeitung personenbezogener Daten zwischen Comptario und unseren Nutzern und stellt die Einhaltung der DSGVO sicher.',
      sections: {
        definitions: {
          title: 'Definitionen',
          items: [
            {
              term: 'Datenverantwortlicher',
              definition:
                'Die Organisation, die Comptario-Dienste nutzt und die Zwecke und Mittel der Verarbeitung personenbezogener Daten bestimmt.',
            },
            {
              term: 'Datenverarbeiter',
              definition:
                'Das Unternehmen Comptario, das personenbezogene Daten im Auftrag des Datenverantwortlichen verarbeitet.',
            },
            {
              term: 'Personenbezogene Daten',
              definition:
                'Alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person beziehen.',
            },
            {
              term: 'Verarbeitung',
              definition:
                'Jeder Vorgang im Zusammenhang mit personenbezogenen Daten (Erhebung, Erfassung, Organisation, Strukturierung, Speicherung, Anpassung, Abruf, Einsichtnahme, Verwendung, Offenlegung, Übermittlung, Verbreitung, Abgleich, Kombination, Einschränkung, Löschung oder Vernichtung).',
            },
          ],
        },
        processing: {
          title: 'Details zur Datenverarbeitung',
          categories: {
            title: 'Kategorien personenbezogener Daten',
            items: [
              'Identitätsinformationen (Name, Nachname, E-Mail)',
              'Kontaktinformationen (Telefon, Adresse)',
              'Finanzdaten (Rechnungsinformationen, Zahlungsaufzeichnungen)',
              'Geschäftsdaten (Account-Datensätze, Produktinformationen)',
              'Technische Daten (IP-Adresse, Nutzungsprotokolle)',
            ],
          },
          purposes: {
            title: 'Zwecke der Verarbeitung',
            items: [
              'Bereitstellung von Buchhaltungs- und Finanzdienstleistungen',
              'Support-Services',
              'Systemsicherheit und Leistungsoptimierung',
              'Einhaltung gesetzlicher Verpflichtungen',
              'Serviceentwicklung und Analyse',
            ],
          },
          subjects: {
            title: 'Kategorien von betroffenen Personen',
            items: [
              'Organisationsvertreter',
              'Endbenutzer',
              'Lieferanten',
              'Geschäftspartner',
              'Website-Besucher',
            ],
          },
        },
        obligations: {
          title: 'Verpflichtungen von Comptario',
          items: [
            'Verarbeitung personenbezogener Daten nur nach Nutzeranweisungen',
            'Umsetzung angemessener technischer und organisatorischer Sicherheitsmaßnahmen',
            'Gewährleistung der Vertraulichkeitsverpflichtungen der Mitarbeiter',
            'Einholung der Genehmigung des Nutzers für die Nutzung von Unterauftragsverarbeitern',
            'Unverzügliche Meldung von Datenschutzverletzungen',
            'Unterstützung bei der Ausübung von Rechten betroffener Personen',
            'Unterstützung der Audit-Rechte des Nutzers',
          ],
        },
        security: {
          title: 'Sicherheitsmaßnahmen',
          items: [
            'Datenverschlüsselung (bei Übertragung und im Ruhezustand)',
            'Zugriffskontrolle und Authentifizierung',
            'Regelmäßige Sicherheitstests und Penetrationstests',
            'Sicherheitsschulungen für Mitarbeiter',
            'Vorfallerkennungs- und Reaktionsverfahren',
            'Regelmäßige Sicherheitsupdates',
          ],
        },
        internationalTransfers: {
          title: 'Internationale Übermittlungen',
          content:
            'Personenbezogene Daten werden primär innerhalb der EU/des EWR verarbeitet. Bei Übermittlungen in Drittländer werden Transfer Impact Assessments durchgeführt und Standardvertragsklauseln (SCCs) sowie zusätzliche technische/organisatorische Maßnahmen angewandt.',
        },
        additionalSecurity: {
          title: 'Zusätzliche Sicherheitsmaßnahmen',
          items: [
            'Pseudonymisierung/Anonymisierung von Nutzerdaten, wenn möglich',
            'Getrennte Produktions- und Testumgebungen',
            'Durchsetzung des Least-Privilege-Prinzips beim Zugriff',
          ],
        },
        dataSubjects: {
          title: 'Rechte der betroffenen Personen',
          items: [
            'Recht auf Information',
            'Recht auf Auskunft',
            'Recht auf Berichtigung',
            'Recht auf Löschung ("Recht auf Vergessenwerden")',
            'Recht auf Einschränkung der Verarbeitung',
            'Recht auf Datenübertragbarkeit',
            'Widerspruchsrecht',
          ],
        },
        contact: {
          title: 'Kontaktinformationen',
          dpo: 'Datenschutzbeauftragter',
          email: COMPANY_LEGAL.dataProtectionEmail || 'privacy@comptario.com',
          address: `${COMPANY_LEGAL.companyName}, ${COMPANY_LEGAL.address}`,
          phone: COMPANY_LEGAL.phone || '',
        },
      },
    },
    fr: {
      title: 'Accord de Traitement des Données (DPA)',
      subtitle:
        'Accord de traitement des données personnelles entre Comptario et les utilisateurs et informations de conformité RGPD',
      lastUpdated: 'Dernière mise à jour',
      overview: 'Aperçu',
      overviewText:
        'Cet Accord de Traitement des Données (DPA) régit les activités de traitement des données personnelles entre Comptario et nos utilisateurs utilisant nos services, garantissant la conformité au RGPD.',
      sections: {
        definitions: {
          title: 'Définitions',
          items: [
            {
              term: 'Responsable du Traitement',
              definition:
                "L'organisation utilisant les services Comptario qui détermine les finalités et les moyens du traitement des données personnelles.",
            },
            {
              term: 'Sous-traitant',
              definition:
                'La société Comptario qui traite les données personnelles pour le compte du responsable du traitement.',
            },
            {
              term: 'Données Personnelles',
              definition:
                'Toute information concernant une personne physique identifiée ou identifiable.',
            },
            {
              term: 'Traitement',
              definition:
                'Toute opération effectuée sur des données personnelles (collecte, enregistrement, organisation, structuration, conservation, adaptation, extraction, consultation, utilisation, communication, diffusion, rapprochement, interconnexion, limitation, effacement ou destruction).',
            },
          ],
        },
        processing: {
          title: 'Détails du Traitement des Données',
          categories: {
            title: 'Catégories de Données Personnelles',
            items: [
              "Informations d'identité (nom, prénom, email)",
              'Informations de contact (téléphone, adresse)',
              'Données financières (informations de facturation, enregistrements de paiement)',
              'Données commerciales (dossiers de comptes, informations produits)',
              "Données techniques (adresse IP, journaux d'utilisation)",
            ],
          },
          purposes: {
            title: 'Finalités du Traitement',
            items: [
              'Fourniture de services comptables et financiers',
              'Services de support',
              'Sécurité du système et optimisation des performances',
              'Respect des obligations légales',
              'Développement et analyse des services',
            ],
          },
          subjects: {
            title: 'Catégories de Personnes Concernées',
            items: [
              "Représentants de l'organisation",
              'Utilisateurs finaux',
              'Fournisseurs',
              'Partenaires commerciaux',
              'Visiteurs du site web',
            ],
          },
        },
        obligations: {
          title: 'Obligations de Comptario',
          items: [
            "Traiter les données personnelles uniquement selon les instructions de l'utilisateur",
            'Mettre en œuvre des mesures de sécurité techniques et organisationnelles appropriées',
            'Assurer les obligations de confidentialité du personnel',
            "Obtenir l'approbation de l'utilisateur pour l'utilisation de sous-traitants",
            'Notifier les violations de données sans délai',
            "Assister dans l'exercice des droits des personnes concernées",
            "Soutenir les droits d'audit de l'utilisateur",
          ],
        },
        security: {
          title: 'Mesures de Sécurité',
          items: [
            'Chiffrement des données (en transit et au repos)',
            "Contrôle d'accès et authentification",
            'Tests de sécurité réguliers et tests de pénétration',
            'Formation à la sécurité du personnel',
            'Procédures de réponse aux incidents',
            'Mises à jour de sécurité régulières',
          ],
        },
        internationalTransfers: {
          title: 'Transferts internationaux',
          content:
            "Les données personnelles sont principalement traitées au sein de l'UE/EEE. En cas de transferts vers des pays tiers, des évaluations d'impact sur les transferts sont réalisées et les Clauses Contractuelles Types (CCT) ainsi que des mesures techniques/organisationnelles supplémentaires sont appliquées.",
        },
        additionalSecurity: {
          title: 'Mesures de sécurité supplémentaires',
          items: [
            'Pseudonymisation/Anonymisation des données de compte lorsque possible',
            'Environnements de production et de test séparés',
            'Contrôles d’accès selon le principe du moindre privilège',
          ],
        },
        dataSubjects: {
          title: 'Droits des Personnes Concernées',
          items: [
            "Droit d'être informé",
            'Droit d’accès',
            'Droit de rectification',
            "Droit à l'effacement (\"droit à l'oubli\")",
            'Droit de limiter le traitement',
            'Droit à la portabilité des données',
            "Droit d'opposition",
          ],
        },
        contact: {
          title: 'Informations de Contact',
          dpo: 'Délégué à la Protection des Données',
          email: COMPANY_LEGAL.dataProtectionEmail || 'privacy@comptario.com',
          address: `${COMPANY_LEGAL.companyName}, ${COMPANY_LEGAL.address}`,
          phone: COMPANY_LEGAL.phone || '',
        },
      },
    },
  } as const;

  const t = texts[currentLanguage as keyof typeof texts] || texts.tr;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t.title}</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t.subtitle}</p>
          <div className="flex items-center justify-center mt-6 text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-2" />
            <span>
              {t.lastUpdated}: 10.11.2025
            </span>
          </div>
        </div>

        {/* Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center mb-4">
            <Shield className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">{t.overview}</h2>
          </div>
          <p className="text-gray-700 leading-relaxed">{t.overviewText}</p>
        </div>

        {/* Definitions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.sections.definitions.title}</h2>
          <div className="space-y-4">
            {t.sections.definitions.items.map((item, index) => (
              <div key={index} className="border-l-4 border-blue-600 pl-4">
                <dt className="font-semibold text-gray-900">{item.term}</dt>
                <dd className="text-gray-700 mt-1">{item.definition}</dd>
              </div>
            ))}
          </div>
        </div>

        {/* Data Processing Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center mb-6">
            <Database className="h-6 w-6 text-green-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">{t.sections.processing.title}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Categories */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.sections.processing.categories.title}</h3>
              <ul className="space-y-2">
                {t.sections.processing.categories.items.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Purposes */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.sections.processing.purposes.title}</h3>
              <ul className="space-y-2">
                {t.sections.processing.purposes.items.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Subjects */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.sections.processing.subjects.title}</h3>
              <ul className="space-y-2">
                {t.sections.processing.subjects.items.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <Users className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Comptario's Obligations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.sections.obligations.title}</h2>
          <ul className="grid md:grid-cols-2 gap-3">
            {t.sections.obligations.items.map((item, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Security Measures */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center mb-6">
            <Shield className="h-6 w-6 text-red-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">{t.sections.security.title}</h2>
          </div>
          <ul className="grid md:grid-cols-2 gap-3">
            {t.sections.security.items.map((item, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* International Transfers */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t.sections.internationalTransfers.title}</h2>
          <p className="text-gray-700 leading-relaxed">{t.sections.internationalTransfers.content}</p>
        </div>

        {/* Additional Security Measures */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t.sections.additionalSecurity.title}</h2>
          <ul className="grid md:grid-cols-2 gap-3">
            {t.sections.additionalSecurity.items.map((item, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Data Subject Rights */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center mb-6">
            <Users className="h-6 w-6 text-purple-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">{t.sections.dataSubjects.title}</h2>
          </div>
          <ul className="grid md:grid-cols-2 gap-3">
            {t.sections.dataSubjects.items.map((item, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle className="h-5 w-5 text-purple-500 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact Information */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.sections.contact.title}</h2>
          <div className="space-y-2">
            <p>
              <strong>{t.sections.contact.dpo}:</strong>
            </p>
            <p className="text-gray-700">📧 {t.sections.contact.email}</p>
            <p className="text-gray-700">🏢 {t.sections.contact.address}</p>
            {t.sections.contact.phone ? (
              <p className="text-gray-700">📞 {t.sections.contact.phone}</p>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            {currentLanguage === 'tr'
              ? 'Bu DPA, GDPR ve diğer veri koruma düzenlemelerine uygun olarak hazırlanmıştır.'
              : currentLanguage === 'en'
              ? 'This DPA has been prepared in accordance with GDPR and other data protection regulations.'
              : currentLanguage === 'de'
              ? 'Diese DPA wurde in Übereinstimmung mit der DSGVO und anderen Datenschutzbestimmungen erstellt.'
              : 'Ce DPA a été préparé conformément au RGPD et aux autres réglementations sur la protection des données.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataProcessingAgreement;