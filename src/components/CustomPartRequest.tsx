import { useState, useRef, useCallback } from 'react'
import {
  Camera, X, Car, Building2, FileText, Send,
  RotateCcw, ChevronRight, ChevronLeft, Check, Box,
  Image as ImageIcon, Loader2, Cuboid, Upload, File, ShoppingBag, Briefcase
} from 'lucide-react'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { ContactFormContent } from './Contact'

interface UploadedImage {
  id: string
  file: File
  preview: string
  angle: string
}

interface PartDetails {
  vehicleMake: string
  vehicleModel: string
  vehicleYear: string
  partName: string
  partDescription: string
  dimensions: string
  material: string
  quantity: number
  finish: string
  urgency: string
}

interface B2BInfo {
  companyName: string
  vatNumber: string
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string
}

type Step = 'upload' | 'details' | 'b2b' | 'review' | 'submitted'

const ANGLES = ['Front', 'Back', 'Left Side', 'Right Side', 'Top', 'Bottom', 'Detail Close-up', 'Other']

function ImageUploadZone({
  images,
  onAdd,
  onRemove,
}: {
  images: UploadedImage[]
  onAdd: (files: FileList) => void
  onRemove: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length) onAdd(e.dataTransfer.files)
    },
    [onAdd]
  )

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-accent-amber bg-accent-amber/5'
            : 'border-border hover:border-accent-amber/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onAdd(e.target.files)}
        />
        <Camera size={36} className="mx-auto text-accent-amber/50 mb-3" />
        <p className="font-mono text-sm text-text-primary mb-1">
          Drop photos of your part here
        </p>
        <p className="text-text-muted text-xs">
          Upload multiple angles for better 3D reconstruction. JPG, PNG supported.
        </p>
        <p className="text-accent-amber text-xs font-mono mt-2">
          Best results: 4-8 photos from different angles
        </p>
      </div>

      {/* Angle guide */}
      <div className="card-base p-4">
        <p className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">
          Recommended angles for best 3D results:
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {ANGLES.map((angle) => {
            const hasAngle = images.some((img) => img.angle === angle)
            return (
              <div
                key={angle}
                className={`text-center p-2 rounded border text-xs ${
                  hasAngle
                    ? 'border-accent-green/50 bg-accent-green/5 text-accent-green'
                    : 'border-border text-text-muted'
                }`}
              >
                {hasAngle ? <Check size={12} className="mx-auto mb-1" /> : <ImageIcon size={12} className="mx-auto mb-1 opacity-40" />}
                {angle}
              </div>
            )
          })}
        </div>
      </div>

      {/* Uploaded images grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border">
              <img src={img.preview} alt={img.angle} className="w-full h-32 object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(img.id) }}
                  className="p-1.5 bg-red-500/20 rounded-full text-red-400 hover:bg-red-500/40 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-bg-primary/80 px-2 py-1">
                <p className="font-accent text-xs text-text-secondary truncate">{img.angle}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ThreeDPreview({ images }: { images: UploadedImage[] }) {
  const [processing, setProcessing] = useState(false)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = () => {
    setProcessing(true)
    // Simulate 3D generation — in production, this calls a real API (TripoSR, Meshy, etc.)
    setTimeout(() => {
      setProcessing(false)
      setGenerated(true)
    }, 3000)
  }

  if (images.length === 0) return null

  return (
    <div className="card-base p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-sm font-bold text-accent-blue uppercase tracking-wider flex items-center gap-2">
          <Cuboid size={16} /> 3D Preview
        </h3>
        {!generated && (
          <button
            onClick={handleGenerate}
            disabled={processing || images.length < 2}
            className="btn-amber text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Cuboid size={14} /> Generate 3D Preview
              </>
            )}
          </button>
        )}
        {generated && (
          <button
            onClick={() => setGenerated(false)}
            className="text-xs font-mono text-text-muted hover:text-accent-amber transition-colors flex items-center gap-1"
          >
            <RotateCcw size={12} /> Regenerate
          </button>
        )}
      </div>

      {!generated ? (
        <div className="bg-bg-tertiary rounded-lg h-64 flex flex-col items-center justify-center">
          {processing ? (
            <div className="text-center">
              <div className="w-16 h-16 border-2 border-accent-amber border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-mono text-sm text-text-primary mb-1">Processing images...</p>
              <p className="text-text-muted text-xs">Creating 3D reconstruction from {images.length} photos</p>
              <div className="mt-4 w-48 h-1.5 bg-bg-primary rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-accent-amber rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Cuboid size={40} className="mx-auto text-text-muted/30 mb-3" />
              <p className="text-text-secondary text-sm mb-1">Upload at least 2 photos to generate a 3D preview</p>
              <p className="text-text-muted text-xs">{images.length} / 2 minimum photos uploaded</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-bg-tertiary rounded-lg h-64 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Simulated 3D preview — in production this would be a real model-viewer */}
          <div className="relative">
            <Box size={80} className="text-accent-amber/40 animate-spin-slow" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 bg-accent-amber/10 rounded-full animate-pulse" />
            </div>
          </div>
          <p className="font-mono text-xs text-accent-green mt-4 flex items-center gap-1.5">
            <Check size={14} /> 3D Preview Generated
          </p>
          <p className="text-text-muted text-xs mt-1">
            Final high-res model will be created after order confirmation
          </p>
          {/* Glow effect */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-2 bg-accent-amber/20 blur-xl" />
        </div>
      )}

      <p className="text-text-muted text-xs mt-3 text-center">
        Preview is approximate. Our team will create the final production-ready 3D model from your photos and provide an accurate quote.
      </p>
    </div>
  )
}

interface UploadedFile {
  id: string
  file: File
  name: string
  size: string
}

const FILE_3D_EXTENSIONS = '.stl,.obj,.step,.stp,.3mf,.iges,.igs,.fbx,.glb,.gltf'

function FileUploadZone({
  files,
  onAdd,
  onRemove,
}: {
  files: UploadedFile[]
  onAdd: (files: FileList) => void
  onRemove: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length) onAdd(e.dataTransfer.files)
    },
    [onAdd]
  )

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <File size={16} className="text-accent-blue" />
        <h3 className="font-mono text-sm font-bold text-text-primary uppercase tracking-wider">
          Or upload a 3D file
        </h3>
        <span className="text-text-muted text-xs">(optional)</span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-accent-blue bg-accent-blue/5'
            : 'border-border hover:border-accent-blue/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={FILE_3D_EXTENSIONS}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onAdd(e.target.files)}
        />
        <Upload size={28} className="mx-auto text-accent-blue/50 mb-2" />
        <p className="font-mono text-sm text-text-primary mb-1">
          Drop your 3D files here
        </p>
        <p className="text-text-muted text-xs">
          STL, OBJ, STEP, 3MF, IGES, FBX, GLB supported
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 bg-bg-tertiary rounded-lg px-4 py-2.5 border border-border">
              <Cuboid size={18} className="text-accent-blue shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-text-primary truncate">{f.name}</p>
                <p className="text-text-muted text-xs">{f.size}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(f.id) }}
                className="p-1 text-text-muted hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function CustomPartRequest() {
  const ref = useScrollReveal<HTMLElement>()
  const addPartRequest = useNotificationsStore((s) => s.addPartRequest)
  // Top-level mode: 'b2b' shows the full Custom Part wizard, 'shopper' shows
  // a regular contact form for individual customers.
  const [mode, setMode] = useState<'b2b' | 'shopper'>('b2b')
  const [step, setStep] = useState<Step>('upload')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [angleIdx, setAngleIdx] = useState(0)

  const [details, setDetails] = useState<PartDetails>({
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    partName: '',
    partDescription: '',
    dimensions: '',
    material: 'PLA',
    quantity: 1,
    finish: 'raw',
    urgency: 'standard',
  })

  const [b2b, setB2B] = useState<B2BInfo>({
    companyName: '',
    vatNumber: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
  })

  const addImages = (files: FileList) => {
    const newImages: UploadedImage[] = Array.from(files).map((file, i) => ({
      id: `${Date.now()}-${i}`,
      file,
      preview: URL.createObjectURL(file),
      angle: ANGLES[Math.min(angleIdx + i, ANGLES.length - 1)] || 'Other',
    }))
    setAngleIdx((prev) => Math.min(prev + files.length, ANGLES.length - 1))
    setImages((prev) => [...prev, ...newImages])
  }

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id)
      if (img) URL.revokeObjectURL(img.preview)
      return prev.filter((i) => i.id !== id)
    })
  }

  const add3DFiles = (files: FileList) => {
    const newFiles: UploadedFile[] = Array.from(files).map((file, i) => ({
      id: `${Date.now()}-3d-${i}`,
      file,
      name: file.name,
      size: formatFileSize(file.size),
    }))
    setUploadedFiles((prev) => [...prev, ...newFiles])
  }

  const remove3DFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleSubmit = () => {
    const reference = `AP-${Date.now().toString(36).toUpperCase()}`
    addPartRequest({
      reference,
      images: images.length,
      details: { ...details },
      business: { ...b2b },
    })
    setStep('submitted')
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Photos' },
    { key: 'details', label: 'Part Details' },
    { key: 'b2b', label: 'Business Info' },
    { key: 'review', label: 'Review & Submit' },
  ]

  const stepIndex = steps.findIndex((s) => s.key === step)

  return (
    <section id="custom-part" ref={ref} className="py-20 md:py-28 bg-bg-primary">
      <div className={`${mode === 'shopper' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="text-center mb-8 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">{mode === 'b2b' ? 'CUSTOM PART REQUEST' : 'GET IN TOUCH'}</span>
          </h2>
          <p className="text-text-secondary mt-4 max-w-2xl mx-auto">
            {mode === 'b2b'
              ? <>Upload photos of your part from multiple angles, or drop in an STL / 3D file. We'll quote you and print it.<span className="block text-accent-amber font-mono text-sm mt-2">B2B & Automotive Specialists</span></>
              : <>Have a question or a small print job? Send us a message and we'll get back to you.</>
            }
          </p>
        </div>

        {/* Big mode toggle — Business vs Shopper */}
        <div className="flex justify-center mb-12 reveal">
          <div className="inline-flex bg-bg-tertiary border border-border rounded-full p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => setMode('b2b')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-mono text-sm font-bold uppercase tracking-wider transition-all ${
                mode === 'b2b'
                  ? 'bg-accent-amber text-bg-primary shadow-md'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Briefcase size={16} /> Business / Custom Part
            </button>
            <button
              type="button"
              onClick={() => setMode('shopper')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-mono text-sm font-bold uppercase tracking-wider transition-all ${
                mode === 'shopper'
                  ? 'bg-accent-amber text-bg-primary shadow-md'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <ShoppingBag size={16} /> Shopper / Inquiry
            </button>
          </div>
        </div>

        {/* Shopper mode → simple contact form. No `.reveal` wrapper:
            the IntersectionObserver in useScrollReveal runs once on mount
            and never sees content added later by toggling modes — leaving
            it stuck at opacity:0. */}
        {mode === 'shopper' && (
          <div>
            <ContactFormContent />
          </div>
        )}

        {/* B2B mode → full wizard (everything below) */}
        {mode === 'b2b' && (<>

        {/* Step indicator */}
        {step !== 'submitted' && (
          <div className="flex items-center justify-center gap-1 mb-10 reveal">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono cursor-pointer transition-all ${
                    i < stepIndex ? 'text-accent-green'
                    : i === stepIndex ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30'
                    : 'text-text-muted'
                  }`}
                  onClick={() => i <= stepIndex && setStep(s.key)}
                >
                  {i < stepIndex ? <Check size={12} /> : <span className="w-4 text-center">{i + 1}</span>}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-6 h-[2px] mx-1 ${i < stepIndex ? 'bg-accent-green' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="reveal">
          {/* Step 1: Upload Photos */}
          {step === 'upload' && (
            <div>
              <ImageUploadZone images={images} onAdd={addImages} onRemove={removeImage} />
              <ThreeDPreview images={images} />

              <FileUploadZone files={uploadedFiles} onAdd={add3DFiles} onRemove={remove3DFile} />

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setStep('details')}
                  disabled={images.length === 0 && uploadedFiles.length === 0}
                  className="btn-amber flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next: Part Details <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Part Details */}
          {step === 'details' && (
            <div className="space-y-6">
              <div className="card-base p-5">
                <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Car size={16} /> Vehicle Information
                </h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Make</label>
                    <input value={details.vehicleMake} onChange={(e) => setDetails({ ...details, vehicleMake: e.target.value })} className="input-field" placeholder="e.g. BMW, Mercedes" />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Model</label>
                    <input value={details.vehicleModel} onChange={(e) => setDetails({ ...details, vehicleModel: e.target.value })} className="input-field" placeholder="e.g. E46, W204" />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Year</label>
                    <input value={details.vehicleYear} onChange={(e) => setDetails({ ...details, vehicleYear: e.target.value })} className="input-field" placeholder="e.g. 2020" />
                  </div>
                </div>
              </div>

              <div className="card-base p-5">
                <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileText size={16} /> Part Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Part Name</label>
                    <input value={details.partName} onChange={(e) => setDetails({ ...details, partName: e.target.value })} className="input-field" placeholder="e.g. Mirror Cover, Dashboard Vent Trim" />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Description / Notes</label>
                    <textarea value={details.partDescription} onChange={(e) => setDetails({ ...details, partDescription: e.target.value })} className="input-field resize-none" rows={3} placeholder="Describe the part, any damage to replicate or fix, specific requirements..." />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Approximate Dimensions (mm)</label>
                    <input value={details.dimensions} onChange={(e) => setDetails({ ...details, dimensions: e.target.value })} className="input-field" placeholder="e.g. 150 × 80 × 20 mm" />
                  </div>
                </div>
              </div>

              <div className="card-base p-5">
                <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider mb-4">Print Specifications</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Material</label>
                    <select value={details.material} onChange={(e) => setDetails({ ...details, material: e.target.value })} className="input-field">
                      <option value="PLA">PLA — Standard</option>
                      <option value="PETG">PETG — Heat & Impact Resistant</option>
                      <option value="ABS">ABS — Automotive Grade</option>
                      <option value="TPU">TPU — Flexible</option>
                      <option value="Nylon">Nylon — High Strength</option>
                      <option value="Resin">Resin — High Detail</option>
                      <option value="unsure">Not sure — recommend for me</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Quantity</label>
                    <input type="number" min={1} value={details.quantity} onChange={(e) => setDetails({ ...details, quantity: parseInt(e.target.value) || 1 })} className="input-field" />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Surface Finish</label>
                    <select value={details.finish} onChange={(e) => setDetails({ ...details, finish: e.target.value })} className="input-field">
                      <option value="raw">Raw Print</option>
                      <option value="sanded">Sanded Smooth</option>
                      <option value="painted">Painted to Match</option>
                      <option value="coated">UV Coated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Urgency</label>
                    <select value={details.urgency} onChange={(e) => setDetails({ ...details, urgency: e.target.value })} className="input-field">
                      <option value="standard">Standard (5-7 days)</option>
                      <option value="priority">Priority (2-3 days) +30%</option>
                      <option value="rush">Rush (24 hours) +50%</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep('upload')} className="btn-outline flex items-center gap-1.5">
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep('b2b')}
                  disabled={!details.partName}
                  className="btn-amber flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next: Business Info <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: B2B Info */}
          {step === 'b2b' && (
            <div className="space-y-6">
              <div className="card-base p-5">
                <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Building2 size={16} /> Business Information
                </h3>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-xs text-text-muted uppercase mb-1">Company Name</label>
                      <input value={b2b.companyName} onChange={(e) => setB2B({ ...b2b, companyName: e.target.value })} className="input-field" placeholder="Your company" />
                    </div>
                    <div>
                      <label className="block font-mono text-xs text-text-muted uppercase mb-1">VAT Number</label>
                      <input value={b2b.vatNumber} onChange={(e) => setB2B({ ...b2b, vatNumber: e.target.value })} className="input-field" placeholder="CY12345678X" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Contact Name</label>
                    <input value={b2b.contactName} onChange={(e) => setB2B({ ...b2b, contactName: e.target.value })} className="input-field" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-xs text-text-muted uppercase mb-1">Email</label>
                      <input type="email" value={b2b.contactEmail} onChange={(e) => setB2B({ ...b2b, contactEmail: e.target.value })} className="input-field" />
                    </div>
                    <div>
                      <label className="block font-mono text-xs text-text-muted uppercase mb-1">Phone</label>
                      <input type="tel" value={b2b.contactPhone} onChange={(e) => setB2B({ ...b2b, contactPhone: e.target.value })} className="input-field" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Additional Notes</label>
                    <textarea value={b2b.notes} onChange={(e) => setB2B({ ...b2b, notes: e.target.value })} className="input-field resize-none" rows={3} placeholder="Recurring order needs, bulk pricing questions, special requirements..." />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep('details')} className="btn-outline flex items-center gap-1.5">
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  disabled={!b2b.contactEmail || !b2b.contactName}
                  className="btn-amber flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Review Order <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Photos summary */}
              {images.length > 0 && (
                <div className="card-base p-5">
                  <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Uploaded Photos</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img) => (
                      <img key={img.id} src={img.preview} alt={img.angle} className="w-16 h-16 rounded object-cover border border-border shrink-0" />
                    ))}
                  </div>
                  <p className="text-text-secondary text-xs mt-2">{images.length} photos from multiple angles</p>
                </div>
              )}

              {/* 3D files summary */}
              {uploadedFiles.length > 0 && (
                <div className="card-base p-5">
                  <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">3D Files</h3>
                  <div className="space-y-2">
                    {uploadedFiles.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 text-sm">
                        <Cuboid size={14} className="text-accent-blue" />
                        <span className="text-text-primary font-accent">{f.name}</span>
                        <span className="text-text-muted text-xs">({f.size})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Part summary */}
              <div className="card-base p-5">
                <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Part Details</h3>
                <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
                  <span className="text-text-muted">Vehicle:</span>
                  <span className="text-text-primary font-accent">{details.vehicleMake} {details.vehicleModel} {details.vehicleYear}</span>
                  <span className="text-text-muted">Part:</span>
                  <span className="text-text-primary font-accent">{details.partName}</span>
                  <span className="text-text-muted">Material:</span>
                  <span className="text-text-primary font-accent">{details.material}</span>
                  <span className="text-text-muted">Quantity:</span>
                  <span className="text-text-primary font-accent">{details.quantity}</span>
                  <span className="text-text-muted">Finish:</span>
                  <span className="text-text-primary font-accent capitalize">{details.finish}</span>
                  <span className="text-text-muted">Urgency:</span>
                  <span className="text-text-primary font-accent capitalize">{details.urgency}</span>
                  {details.dimensions && (
                    <>
                      <span className="text-text-muted">Dimensions:</span>
                      <span className="text-text-primary font-accent">{details.dimensions}</span>
                    </>
                  )}
                </div>
                {details.partDescription && (
                  <p className="text-text-secondary text-xs mt-3 border-t border-border pt-3">{details.partDescription}</p>
                )}
              </div>

              {/* B2B summary */}
              <div className="card-base p-5">
                <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Business Contact</h3>
                <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
                  {b2b.companyName && (
                    <><span className="text-text-muted">Company:</span><span className="text-text-primary font-accent">{b2b.companyName}</span></>
                  )}
                  {b2b.vatNumber && (
                    <><span className="text-text-muted">VAT:</span><span className="text-text-primary font-accent">{b2b.vatNumber}</span></>
                  )}
                  <span className="text-text-muted">Contact:</span>
                  <span className="text-text-primary font-accent">{b2b.contactName}</span>
                  <span className="text-text-muted">Email:</span>
                  <span className="text-text-primary font-accent">{b2b.contactEmail}</span>
                  {b2b.contactPhone && (
                    <><span className="text-text-muted">Phone:</span><span className="text-text-primary font-accent">{b2b.contactPhone}</span></>
                  )}
                </div>
              </div>

              {/* Quote notice */}
              <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-4 text-center">
                <p className="font-mono text-sm text-accent-amber mb-1">What happens next?</p>
                <p className="text-text-secondary text-xs leading-relaxed">
                  Our team will review your photos, create a production-ready 3D model, and send you a detailed quote within 24 hours.
                  For bulk/recurring orders we offer volume discounts.
                </p>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep('b2b')} className="btn-outline flex items-center gap-1.5">
                  <ChevronLeft size={16} /> Back
                </button>
                <button onClick={handleSubmit} className="btn-amber flex items-center gap-1.5">
                  <Send size={16} /> Submit Quote Request
                </button>
              </div>
            </div>
          )}

          {/* Submitted */}
          {step === 'submitted' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-accent-green/10 border-2 border-accent-green rounded-full flex items-center justify-center mx-auto mb-5">
                <Check size={40} className="text-accent-green" />
              </div>
              <h3 className="font-mono text-2xl font-bold text-text-primary mb-3">Request Submitted!</h3>
              <p className="text-text-secondary max-w-md mx-auto mb-2">
                We've received your custom part request{images.length > 0 ? ` with ${images.length} photos` : ''}{uploadedFiles.length > 0 ? ` and ${uploadedFiles.length} 3D file${uploadedFiles.length > 1 ? 's' : ''}` : ''}.
              </p>
              <p className="text-text-secondary max-w-md mx-auto mb-6">
                Our team will create a 3D model from your images and send you a detailed quote to <span className="text-accent-amber font-accent">{b2b.contactEmail}</span> within 24 hours.
              </p>
              <div className="card-base inline-block p-4 mb-6">
                <p className="font-mono text-xs text-text-muted uppercase mb-1">Your Reference</p>
                <p className="font-mono text-lg text-accent-amber">AP-{Date.now().toString(36).toUpperCase()}</p>
              </div>
              <div>
                <button
                  onClick={() => {
                    setStep('upload')
                    setImages([])
                    setDetails({ ...details, partName: '', partDescription: '', vehicleMake: '', vehicleModel: '', vehicleYear: '', dimensions: '', quantity: 1 })
                  }}
                  className="btn-outline"
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          )}
        </div>
        </>)}
      </div>
    </section>
  )
}
