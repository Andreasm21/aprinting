import { useState } from 'react'
import { Mail, Globe, Copy, Check, FileText, ChevronDown } from 'lucide-react'
import { useNotificationsStore, type OrderNotification, type PartRequestNotification } from '@/stores/notificationsStore'
import { useCustomersStore } from '@/stores/customersStore'

type TemplateName = 'welcome' | 'order_confirmed' | 'order_ready' | 'shipped' | 'quote_ready'
type Lang = 'en' | 'gr'

interface TemplateVars {
  name: string
  email: string
  orderNumber: string
  total: string
  items: string
  deliveryType: string
  companyName: string
  quoteRef: string
  validUntil: string
  trackingNumber: string
  estimatedDelivery: string
}

const defaultVars: TemplateVars = {
  name: 'John Doe',
  email: 'john@example.com',
  orderNumber: 'APR-2026-0001',
  total: '€45.00',
  items: '1× Phone Stand (€8.00)\n1× Cable Organizer (€12.00)\n1× Desk Organizer (€25.00)',
  deliveryType: 'Delivery',
  companyName: '',
  quoteRef: 'QT-2026-0001',
  validUntil: '30 April 2026',
  trackingNumber: 'CY1234567890',
  estimatedDelivery: '2-3 business days',
}

function fillTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{name\}\}/g, vars.name)
    .replace(/\{\{email\}\}/g, vars.email)
    .replace(/\{\{orderNumber\}\}/g, vars.orderNumber)
    .replace(/\{\{total\}\}/g, vars.total)
    .replace(/\{\{items\}\}/g, vars.items)
    .replace(/\{\{deliveryType\}\}/g, vars.deliveryType)
    .replace(/\{\{companyName\}\}/g, vars.companyName)
    .replace(/\{\{quoteRef\}\}/g, vars.quoteRef)
    .replace(/\{\{validUntil\}\}/g, vars.validUntil)
    .replace(/\{\{trackingNumber\}\}/g, vars.trackingNumber)
    .replace(/\{\{estimatedDelivery\}\}/g, vars.estimatedDelivery)
}

const templates: Record<TemplateName, Record<Lang, { subject: string; body: string }>> = {
  welcome: {
    en: {
      subject: 'Welcome to APrinting! 🎉',
      body: `Hi {{name}},

Welcome to APrinting! We're thrilled to have you on board.

Your account has been created successfully. Here's what you can look forward to:

✅ Fast & professional 3D printing (FDM & Resin)
✅ Cyprus-wide delivery or convenient pickup
✅ Custom parts, prototypes, and ready-made products
✅ Dedicated support for all your printing needs

If you have any questions or want to discuss a project, don't hesitate to reach out. We're here to bring your ideas to life!

Best regards,
The APrinting Team
Cyprus 🇨🇾

---
APrinting — From Digital to Physical
hello@aprinting.cy`,
    },
    gr: {
      subject: 'Καλώς ήρθατε στην APrinting! 🎉',
      body: `Γεια σας {{name}},

Καλώς ήρθατε στην APrinting! Είμαστε ενθουσιασμένοι που σας έχουμε μαζί μας.

Ο λογαριασμός σας δημιουργήθηκε επιτυχώς. Δείτε τι μπορείτε να περιμένετε:

✅ Γρήγορη & επαγγελματική 3D εκτύπωση (FDM & Resin)
✅ Παγκύπρια παράδοση ή παραλαβή από το κατάστημα
✅ Εξαρτήματα κατ' εντολή, πρωτότυπα και έτοιμα προϊόντα
✅ Αφοσιωμένη υποστήριξη για όλες τις ανάγκες εκτύπωσης σας

Αν έχετε οποιαδήποτε ερώτηση ή θέλετε να συζητήσετε ένα έργο, μη διστάσετε να επικοινωνήσετε. Είμαστε εδώ για να ζωντανέψουμε τις ιδέες σας!

Με εκτίμηση,
Η ομάδα APrinting
Κύπρος 🇨🇾

---
APrinting — Από το Ψηφιακό στο Φυσικό
hello@aprinting.cy`,
    },
  },
  order_confirmed: {
    en: {
      subject: 'Order Confirmed — {{orderNumber}}',
      body: `Hi {{name}},

Thank you for your order! We've received it and it's being processed.

📋 Order Details
Order Number: {{orderNumber}}
Delivery Method: {{deliveryType}}

Items:
{{items}}

💰 Total: {{total}}

⏱ What's Next?
Your order will be printed and quality-checked. We'll notify you as soon as it's ready for {{deliveryType}}.

Estimated timeline: 3-5 business days for standard orders.

If you have any questions about your order, just reply to this email or reach us on WhatsApp.

Thank you for choosing APrinting!

Best regards,
The APrinting Team

---
APrinting — From Digital to Physical
hello@aprinting.cy`,
    },
    gr: {
      subject: 'Επιβεβαίωση Παραγγελίας — {{orderNumber}}',
      body: `Γεια σας {{name}},

Ευχαριστούμε για την παραγγελία σας! Την παραλάβαμε και βρίσκεται σε επεξεργασία.

📋 Στοιχεία Παραγγελίας
Αριθμός Παραγγελίας: {{orderNumber}}
Τρόπος Παράδοσης: {{deliveryType}}

Προϊόντα:
{{items}}

💰 Σύνολο: {{total}}

⏱ Επόμενα Βήματα
Η παραγγελία σας θα εκτυπωθεί και θα ελεγχθεί ποιοτικά. Θα σας ειδοποιήσουμε μόλις είναι έτοιμη.

Εκτιμώμενος χρόνος: 3-5 εργάσιμες ημέρες για κανονικές παραγγελίες.

Αν έχετε ερωτήσεις για την παραγγελία σας, απαντήστε σε αυτό το email ή επικοινωνήστε μαζί μας στο WhatsApp.

Ευχαριστούμε που επιλέξατε την APrinting!

Με εκτίμηση,
Η ομάδα APrinting

---
APrinting — Από το Ψηφιακό στο Φυσικό
hello@aprinting.cy`,
    },
  },
  order_ready: {
    en: {
      subject: 'Your Order is Ready! — {{orderNumber}}',
      body: `Hi {{name}},

Great news! Your order {{orderNumber}} is ready! 🎉

📦 Order Total: {{total}}

🏪 Pickup Details:
Come pick up your order at our workshop during business hours.
Mon – Sat: 9:00 – 19:00
Location: Cyprus 🇨🇾

🚚 Delivery:
If you chose delivery, your order will be shipped today and should arrive within {{estimatedDelivery}}.

We hope you love your prints! If there's anything that doesn't meet your expectations, please let us know within 48 hours.

Thank you for choosing APrinting!

Best regards,
The APrinting Team

---
APrinting — From Digital to Physical
hello@aprinting.cy`,
    },
    gr: {
      subject: 'Η Παραγγελία σας είναι Έτοιμη! — {{orderNumber}}',
      body: `Γεια σας {{name}},

Εξαιρετικά νέα! Η παραγγελία σας {{orderNumber}} είναι έτοιμη! 🎉

📦 Σύνολο Παραγγελίας: {{total}}

🏪 Παραλαβή:
Ελάτε να παραλάβετε την παραγγελία σας από το εργαστήριό μας κατά τις ώρες λειτουργίας.
Δευ – Σαβ: 9:00 – 19:00
Τοποθεσία: Κύπρος 🇨🇾

🚚 Παράδοση:
Αν επιλέξατε παράδοση, η παραγγελία σας θα αποσταλεί σήμερα και θα φτάσει εντός {{estimatedDelivery}}.

Ελπίζουμε να σας αρέσουν οι εκτυπώσεις σας! Αν κάτι δεν ανταποκρίνεται στις προσδοκίες σας, ενημερώστε μας εντός 48 ωρών.

Ευχαριστούμε που επιλέξατε την APrinting!

Με εκτίμηση,
Η ομάδα APrinting

---
APrinting — Από το Ψηφιακό στο Φυσικό
hello@aprinting.cy`,
    },
  },
  shipped: {
    en: {
      subject: 'Your Order Has Been Shipped! — {{orderNumber}}',
      body: `Hi {{name}},

Your order {{orderNumber}} has been shipped! 🚚

📦 Tracking Number: {{trackingNumber}}
📅 Estimated Delivery: {{estimatedDelivery}}
💰 Order Total: {{total}}

You can track your package using the tracking number above.

📌 Delivery Tips:
• Someone should be available at the delivery address to receive the package
• If you're not home, the courier may leave it with a neighbor or attempt redelivery
• Contact us immediately if there are any issues with your delivery

Thank you for shopping with APrinting!

Best regards,
The APrinting Team

---
APrinting — From Digital to Physical
hello@aprinting.cy`,
    },
    gr: {
      subject: 'Η Παραγγελία σας Απεστάλη! — {{orderNumber}}',
      body: `Γεια σας {{name}},

Η παραγγελία σας {{orderNumber}} απεστάλη! 🚚

📦 Αριθμός Παρακολούθησης: {{trackingNumber}}
📅 Εκτιμώμενη Παράδοση: {{estimatedDelivery}}
💰 Σύνολο Παραγγελίας: {{total}}

Μπορείτε να παρακολουθήσετε το δέμα σας χρησιμοποιώντας τον αριθμό παρακολούθησης.

📌 Συμβουλές Παράδοσης:
• Κάποιος πρέπει να βρίσκεται στη διεύθυνση παράδοσης για να παραλάβει το δέμα
• Αν δεν είστε σπίτι, ο κούριερ μπορεί να το αφήσει σε γείτονα ή να επιχειρήσει εκ νέου παράδοση
• Επικοινωνήστε μαζί μας αμέσως αν υπάρχει οποιοδήποτε πρόβλημα

Ευχαριστούμε που αγοράσατε από την APrinting!

Με εκτίμηση,
Η ομάδα APrinting

---
APrinting — Από το Ψηφιακό στο Φυσικό
hello@aprinting.cy`,
    },
  },
  quote_ready: {
    en: {
      subject: 'Your Quote is Ready — {{quoteRef}}',
      body: `Hi {{name}},

Your custom part quotation is ready! Here are the details:

📋 Quote Reference: {{quoteRef}}
📅 Valid Until: {{validUntil}}
💰 Estimated Total: {{total}}

{{companyName}}

We've reviewed your photos and specifications, and prepared a detailed quote for your custom part. The quote includes material costs, printing, finishing, and delivery.

📌 Next Steps:
1. Review the attached quotation
2. Reply to this email to approve or request changes
3. Once approved, we'll begin production immediately

For bulk orders or recurring parts, we offer volume discounts. Let's discuss!

If you have any questions or want to modify the specifications, don't hesitate to reach out.

Best regards,
The APrinting Team

---
APrinting — From Digital to Physical
hello@aprinting.cy`,
    },
    gr: {
      subject: 'Η Προσφορά σας είναι Έτοιμη — {{quoteRef}}',
      body: `Γεια σας {{name}},

Η προσφορά σας για εξατομικευμένο εξάρτημα είναι έτοιμη! Δείτε τα στοιχεία:

📋 Αριθμός Προσφοράς: {{quoteRef}}
📅 Ισχύς Έως: {{validUntil}}
💰 Εκτιμώμενο Σύνολο: {{total}}

{{companyName}}

Εξετάσαμε τις φωτογραφίες και τις προδιαγραφές σας και ετοιμάσαμε μια λεπτομερή προσφορά. Η προσφορά περιλαμβάνει κόστος υλικών, εκτύπωσης, φινιρίσματος και παράδοσης.

📌 Επόμενα Βήματα:
1. Εξετάστε τη συνημμένη προσφορά
2. Απαντήστε σε αυτό το email για έγκριση ή αλλαγές
3. Μετά την έγκριση, θα ξεκινήσουμε αμέσως την παραγωγή

Για μαζικές παραγγελίες ή επαναλαμβανόμενα εξαρτήματα, προσφέρουμε εκπτώσεις όγκου. Ας το συζητήσουμε!

Αν έχετε ερωτήσεις ή θέλετε να τροποποιήσετε τις προδιαγραφές, μη διστάσετε να επικοινωνήσετε.

Με εκτίμηση,
Η ομάδα APrinting

---
APrinting — Από το Ψηφιακό στο Φυσικό
hello@aprinting.cy`,
    },
  },
}

const templateLabels: Record<TemplateName, string> = {
  welcome: 'Welcome',
  order_confirmed: 'Order Confirmed',
  order_ready: 'Order Ready',
  shipped: 'Order Shipped',
  quote_ready: 'Quote Ready',
}

export default function AdminEmails() {
  const [activeTemplate, setActiveTemplate] = useState<TemplateName>('welcome')
  const [lang, setLang] = useState<Lang>('en')
  const [copied, setCopied] = useState<'html' | 'text' | null>(null)
  const [vars, setVars] = useState<TemplateVars>(defaultVars)
  const [showSourcePicker, setShowSourcePicker] = useState(false)

  const notifications = useNotificationsStore((s) => s.notifications)
  const customers = useCustomersStore((s) => s.customers)

  const orders = notifications.filter((n) => n.type === 'order') as OrderNotification[]
  const partRequests = notifications.filter((n) => n.type === 'part_request') as PartRequestNotification[]

  const template = templates[activeTemplate][lang]
  const filledSubject = fillTemplate(template.subject, vars)
  const filledBody = fillTemplate(template.body, vars)

  const handleCopy = async (type: 'html' | 'text') => {
    const text = type === 'html'
      ? `Subject: ${filledSubject}\n\n${filledBody}`
      : `Subject: ${filledSubject}\n\n${filledBody}`
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const fillFromOrder = (order: OrderNotification) => {
    setVars({
      ...vars,
      name: order.customer.name,
      email: order.customer.email,
      orderNumber: order.id.replace('ord-', 'APR-').slice(0, 14).toUpperCase(),
      total: `€${order.total.toFixed(2)}`,
      items: order.items.map((i) => `${i.quantity}× ${i.name} (€${(i.price * i.quantity).toFixed(2)})`).join('\n'),
      deliveryType: order.customer.deliveryType === 'pickup' ? 'Pickup' : 'Delivery',
    })
    setShowSourcePicker(false)
  }

  const fillFromPartRequest = (pr: PartRequestNotification) => {
    setVars({
      ...vars,
      name: pr.business.contactName,
      email: pr.business.contactEmail,
      companyName: pr.business.companyName ? `Company: ${pr.business.companyName}` : '',
      quoteRef: pr.reference,
    })
    setShowSourcePicker(false)
  }

  const fillFromCustomer = (c: typeof customers[0]) => {
    setVars({
      ...vars,
      name: c.name,
      email: c.email,
      companyName: c.company ? `Company: ${c.company}` : '',
    })
    setShowSourcePicker(false)
  }

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-2">Email Templates</h1>
      <p className="text-text-secondary text-sm mb-6">Ready-to-copy email templates in English and Greek. Select a source to auto-fill variables.</p>

      {/* Template tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(Object.keys(templates) as TemplateName[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTemplate(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs transition-all ${
              activeTemplate === key
                ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-transparent'
            }`}
          >
            <Mail size={12} />
            {templateLabels[key]}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — Controls */}
        <div className="space-y-4">
          {/* Language toggle */}
          <div className="card-base p-4">
            <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Globe size={12} /> Language
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setLang('en')}
                className={`flex-1 py-2 rounded-lg font-mono text-sm transition-all ${
                  lang === 'en' ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30' : 'border border-border text-text-secondary'
                }`}
              >
                🇬🇧 English
              </button>
              <button
                onClick={() => setLang('gr')}
                className={`flex-1 py-2 rounded-lg font-mono text-sm transition-all ${
                  lang === 'gr' ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30' : 'border border-border text-text-secondary'
                }`}
              >
                🇬🇷 Greek
              </button>
            </div>
          </div>

          {/* Source picker */}
          <div className="card-base p-4">
            <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText size={12} /> Fill from data
            </h3>
            <button
              onClick={() => setShowSourcePicker(!showSourcePicker)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border text-text-secondary hover:border-accent-amber text-sm font-mono transition-all"
            >
              Select a source...
              <ChevronDown size={14} className={`transition-transform ${showSourcePicker ? 'rotate-180' : ''}`} />
            </button>

            {showSourcePicker && (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2 bg-bg-primary">
                {customers.length > 0 && (
                  <>
                    <p className="text-[10px] font-mono text-text-muted uppercase px-2 pt-1">Customers</p>
                    {customers.slice(0, 5).map((c) => (
                      <button key={c.id} onClick={() => fillFromCustomer(c)} className="w-full text-left px-2 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors truncate">
                        {c.name} — {c.email}
                      </button>
                    ))}
                  </>
                )}
                {orders.length > 0 && (
                  <>
                    <p className="text-[10px] font-mono text-text-muted uppercase px-2 pt-1">Orders</p>
                    {orders.slice(0, 5).map((o) => (
                      <button key={o.id} onClick={() => fillFromOrder(o)} className="w-full text-left px-2 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors truncate">
                        {o.customer.name} — €{o.total.toFixed(2)}
                      </button>
                    ))}
                  </>
                )}
                {partRequests.length > 0 && (
                  <>
                    <p className="text-[10px] font-mono text-text-muted uppercase px-2 pt-1">Part Requests</p>
                    {partRequests.slice(0, 5).map((pr) => (
                      <button key={pr.id} onClick={() => fillFromPartRequest(pr)} className="w-full text-left px-2 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors truncate">
                        {pr.business.contactName} — {pr.details.partName}
                      </button>
                    ))}
                  </>
                )}
                {customers.length === 0 && orders.length === 0 && partRequests.length === 0 && (
                  <p className="text-text-muted text-xs px-2 py-2">No data available. Place an order or add a customer first.</p>
                )}
              </div>
            )}
          </div>

          {/* Variables editor */}
          <div className="card-base p-4">
            <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Variables</h3>
            <div className="space-y-2">
              {(['name', 'email', 'orderNumber', 'total', 'deliveryType', 'trackingNumber', 'estimatedDelivery', 'quoteRef', 'validUntil'] as const).map((key) => (
                <div key={key}>
                  <label className="text-[10px] font-mono text-text-muted uppercase">{key}</label>
                  <input
                    value={vars[key]}
                    onChange={(e) => setVars({ ...vars, [key]: e.target.value })}
                    className="input-field text-xs py-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Preview */}
        <div className="lg:col-span-2">
          <div className="card-base overflow-hidden">
            {/* Subject */}
            <div className="px-5 py-3 border-b border-border bg-bg-tertiary">
              <p className="text-text-muted text-[10px] font-mono uppercase mb-1">Subject</p>
              <p className="font-mono text-sm text-text-primary">{filledSubject}</p>
            </div>

            {/* Body */}
            <div className="p-5">
              <pre className="font-body text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {filledBody}
              </pre>
            </div>

            {/* Copy buttons */}
            <div className="px-5 py-3 border-t border-border bg-bg-tertiary flex gap-2">
              <button
                onClick={() => handleCopy('text')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs transition-all ${
                  copied === 'text'
                    ? 'bg-accent-green text-bg-primary'
                    : 'btn-amber'
                }`}
              >
                {copied === 'text' ? <Check size={14} /> : <Copy size={14} />}
                {copied === 'text' ? 'Copied!' : 'Copy Email'}
              </button>
              <button
                onClick={() => handleCopy('html')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs transition-all ${
                  copied === 'html'
                    ? 'bg-accent-green text-bg-primary'
                    : 'btn-outline'
                }`}
              >
                {copied === 'html' ? <Check size={14} /> : <Copy size={14} />}
                {copied === 'html' ? 'Copied!' : 'Copy with Subject'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
