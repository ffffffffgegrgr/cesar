import React, { useState, useCallback, useEffect, useRef } from 'react';
import { APU, ResourceType, Resource, Project } from './types';
import ResourceTable from './components/ResourceTable';
import SummaryCard from './components/SummaryCard';
import { generateApuFromDescription } from './services/geminiService';
import JSZip from 'jszip';
import { 
  HardHat, 
  Sparkles, 
  ChevronLeft, 
  Save, 
  LayoutGrid, 
  Settings,
  WifiOff,
  Upload,
  FileJson,
  Printer,
  Code,
  Plus,
  Trash2,
  Edit,
  Search,
  ArrowRight,
  Folder,
  Calendar,
  MoreVertical,
  Briefcase,
  Database,
  Download,
  UploadCloud,
  AlertTriangle
} from 'lucide-react';

// --- Constants & Templates ---

const NEW_APU_TEMPLATE: APU = {
  id: '',
  code: 'NEW-001',
  description: '',
  unit: 'unid',
  quantity: 1,
  resources: [],
  indirectsPercentage: 15,
  profitPercentage: 10,
  category: 'General'
};

const App: React.FC = () => {
  // --- Global State: Projects ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // --- Local State: Current Working View ---
  const [projectAPUs, setProjectAPUs] = useState<APU[]>([]);
  const [editingApuId, setEditingApuId] = useState<string | null>(null);
  const [currentEditorAPU, setCurrentEditorAPU] = useState<APU | null>(null);

  // --- UI State ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  
  // Modals State
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  
  // Delete Confirmation States
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [apuToDelete, setApuToDelete] = useState<APU | null>(null);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence & Initialization ---

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('arquicostos-projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading projects", e);
      }
    }
  }, []);

  // Sync Network Status
  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Save current project state to the global projects list and LocalStorage
  const saveProjectState = (updatedAPUs: APU[]) => {
    if (!currentProject) return;
    
    const updatedProject = {
      ...currentProject,
      apus: updatedAPUs,
      lastModified: Date.now()
    };

    setCurrentProject(updatedProject);
    setProjectAPUs(updatedAPUs);
    
    setProjects(prevProjects => {
      const newProjects = prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p);
      localStorage.setItem('arquicostos-projects', JSON.stringify(newProjects));
      return newProjects;
    });
  };

  // --- Project Management Handlers ---

  const handleOpenCreateProjectModal = () => {
    setNewProjectName('');
    setIsCreatingProject(true);
  };

  const handleConfirmCreateProject = () => {
    if (!newProjectName.trim()) return;

    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName,
      lastModified: Date.now(),
      apus: []
    };

    setProjects(prev => {
      const updated = [...prev, newProject];
      localStorage.setItem('arquicostos-projects', JSON.stringify(updated));
      return updated;
    });
    
    // Auto open and reset views
    setCurrentProject(newProject);
    setProjectAPUs([]);
    setEditingApuId(null);
    setIsCreatingProject(false);
  };

  const handleDeleteProjectClick = (e: React.MouseEvent, project: Project) => {
    // Critical: Stop propagation to prevent opening the project when clicking delete
    e.stopPropagation(); 
    setProjectToDelete(project);
  };

  const handleConfirmDeleteProject = () => {
    if (!projectToDelete) return;

    setProjects(prev => {
      const updated = prev.filter(p => p.id !== projectToDelete.id);
      localStorage.setItem('arquicostos-projects', JSON.stringify(updated));
      return updated;
    });
    setProjectToDelete(null);
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    setProjectAPUs(project.apus);
    setEditingApuId(null);
  };

  const handleCloseProject = () => {
    setCurrentProject(null);
    setProjectAPUs([]);
    setEditingApuId(null);
  };

  // --- APU Management Handlers ---

  const calculateUnitPrice = (apu: APU): number => {
    const directCost = apu.resources.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    const indirects = directCost * (apu.indirectsPercentage / 100);
    const profit = (directCost + indirects) * (apu.profitPercentage / 100);
    return directCost + indirects + profit;
  };

  const calculateTotalFromList = (list: APU[]): number => {
    return list.reduce((acc, apu) => acc + (calculateUnitPrice(apu) * apu.quantity), 0);
  };

  const handleEditItem = (id: string) => {
    const itemToEdit = projectAPUs.find(a => a.id === id);
    if (itemToEdit) {
      setCurrentEditorAPU({ ...itemToEdit });
      setEditingApuId(id);
    }
  };

  const handleCreateItem = () => {
    const newId = Date.now().toString();
    const newItem = { ...NEW_APU_TEMPLATE, id: newId, code: `CON-${projectAPUs.length + 1}` };
    const newAPUs = [...projectAPUs, newItem];
    
    // Update State & Persist
    saveProjectState(newAPUs);
    
    // Auto open editor
    setCurrentEditorAPU(newItem);
    setEditingApuId(newId);
  };

  const handleDeleteApuClick = (e: React.MouseEvent | null, apu: APU) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setApuToDelete(apu);
  };

  const handleConfirmDeleteApu = () => {
    if (!apuToDelete) return;

    const id = apuToDelete.id;
    const newAPUs = projectAPUs.filter(item => item.id !== id);
    saveProjectState(newAPUs);

    if (editingApuId === id) {
      setEditingApuId(null);
      setCurrentEditorAPU(null);
    }
    setApuToDelete(null);
  };

  const handleBackToList = () => {
    if (currentEditorAPU && editingApuId) {
      const newAPUs = projectAPUs.map(item => item.id === editingApuId ? currentEditorAPU : item);
      saveProjectState(newAPUs);
    }
    setEditingApuId(null);
    setCurrentEditorAPU(null);
  };

  // --- Editor Handlers ---

  const updateResources = useCallback((newResources: Resource[]) => {
    setCurrentEditorAPU(prev => prev ? ({ ...prev, resources: newResources }) : null);
  }, []);

  const updateField = (field: keyof APU, value: string | number) => {
    setCurrentEditorAPU(prev => prev ? ({ ...prev, [field]: value }) : null);
  };

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    const generated = await generateApuFromDescription(prompt);
    
    if (generated) {
      if (!editingApuId) {
        // Create new item in list
        const newId = Date.now().toString();
        const newItem: APU = {
          ...NEW_APU_TEMPLATE,
          id: newId,
          description: generated.description || '',
          unit: generated.unit || 'unid',
          resources: generated.resources || [],
        };
        const newAPUs = [...projectAPUs, newItem];
        saveProjectState(newAPUs);
        setShowAiModal(false);
      } else {
        // Update existing item in editor
        setCurrentEditorAPU(prev => prev ? ({
          ...prev,
          description: generated.description || prev.description,
          unit: generated.unit || prev.unit,
          resources: generated.resources || [],
        }) : null);
        setShowAiModal(false);
      }
    }
    setIsGenerating(false);
  };

  // --- Export / Import ---

  const handleExportJSON = () => {
    // Export current project
    if (!currentProject) return;
    const dataStr = JSON.stringify(currentProject, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentProject.name.replace(/\s+/g, '_')}_presupuesto.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportAllData = () => {
    const dataStr = JSON.stringify(projects, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `Respaldo_ArquiCostos_${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ATENCIÓN: Al restaurar una copia de seguridad, se reemplazarán tus proyectos actuales si hay conflictos, o se agregarán. ¿Deseas continuar?")) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json)) {
          // Assume it's an array of Projects
          setProjects(json);
          localStorage.setItem('arquicostos-projects', JSON.stringify(json));
          alert("Copia de seguridad restaurada exitosamente.");
          setShowBackupModal(false);
        } else {
          alert("El archivo no es una copia de seguridad válida.");
        }
      } catch (err) {
        console.error(err);
        alert("Error al leer el archivo.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.apus && json.name) {
          // It's a project
          const newProject = { ...json, id: Date.now().toString() };
          setProjects(prev => {
            const updated = [...prev, newProject];
            localStorage.setItem('arquicostos-projects', JSON.stringify(updated));
            return updated;
          });
          alert("Proyecto importado exitosamente.");
        } else if (Array.isArray(json)) {
          // Old format or list of APUs, import as new Project
          const newProject: Project = {
            id: Date.now().toString(),
            name: "Proyecto Importado",
            lastModified: Date.now(),
            apus: json
          };
           setProjects(prev => {
            const updated = [...prev, newProject];
            localStorage.setItem('arquicostos-projects', JSON.stringify(updated));
            return updated;
          });
          alert("Proyecto importado exitosamente.");
        } else {
          alert("Formato no reconocido.");
        }
      } catch (err) {
        console.error(err);
        alert("Error al leer el archivo.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- Views ---

  const renderDashboard = () => (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
             <Briefcase className="text-primary-600" size={32} />
             Mis Proyectos
          </h1>
          <p className="text-slate-500 mt-1">Gestiona tus presupuestos y análisis de costos</p>
        </div>
        <div className="flex gap-3">
          <button 
             onClick={() => fileInputRef.current?.click()}
             className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
             <Upload size={18} />
             Importar
          </button>
          <button 
             onClick={handleOpenCreateProjectModal}
             className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
          >
             <Plus size={18} />
             Nuevo Proyecto
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
           <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Folder size={40} className="text-slate-300" />
           </div>
           <h3 className="text-xl font-bold text-slate-700 mb-2">No tienes proyectos aún</h3>
           <p className="text-slate-500 mb-6 max-w-md mx-auto">Crea tu primer proyecto para empezar a gestionar tus precios unitarios de construcción.</p>
           <button 
             onClick={handleOpenCreateProjectModal}
             className="text-primary-600 font-bold hover:underline"
           >
             + Crear Proyecto Ahora
           </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {projects.map(project => {
             const totalCost = calculateTotalFromList(project.apus);
             return (
               <div 
                  key={project.id}
                  onClick={() => handleOpenProject(project)}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group relative"
               >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Folder className="text-primary-600" size={24} />
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => handleDeleteProjectClick(e, project)}
                      className="relative z-10 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                      title="Eliminar Proyecto"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-primary-600 transition-colors">
                    {project.name}
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                    <Calendar size={12} />
                    Modificado: {new Date(project.lastModified).toLocaleDateString()}
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase block">Conceptos</span>
                      <span className="font-bold text-slate-700">{project.apus.length}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-400 uppercase block">Total</span>
                      <span className="font-bold text-slate-900 text-lg">${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
               </div>
             )
           })}
        </div>
      )}
    </div>
  );

  const renderListView = () => (
    <div className="animate-fade-in">
      <div className="flex flex-col gap-6 mb-8">
        {/* Breadcrumb / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button 
              onClick={handleCloseProject}
              className="flex items-center gap-2 text-slate-500 text-sm mb-2 hover:text-primary-600 transition-colors"
            >
              <ChevronLeft size={16} /> Volver a Proyectos
            </button>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <span className="text-slate-400 font-light">Proyecto:</span> {currentProject?.name}
            </h1>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={handleExportJSON}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
             >
                <FileJson size={18} />
                Exportar JSON
             </button>
             <button 
                onClick={() => isOnline && setShowAiModal(true)}
                disabled={!isOnline}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition-all ${
                  isOnline ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-slate-400 cursor-not-allowed'
                }`}
             >
                {isOnline ? <Sparkles size={18} /> : <WifiOff size={18} />}
                {isOnline ? 'Crear con IA' : 'IA Offline'}
             </button>
             <button 
                onClick={handleCreateItem}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
             >
                <Plus size={18} />
                Agregar Concepto
             </button>
          </div>
        </div>

        {/* Project Stats Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
             <span className="text-xs font-semibold text-slate-500 uppercase">Costo Total Proyecto</span>
             <div className="text-2xl font-bold text-slate-900 mt-1">${calculateTotalFromList(projectAPUs).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
             <span className="text-xs font-semibold text-slate-500 uppercase">Total Conceptos</span>
             <div className="text-2xl font-bold text-slate-900 mt-1">{projectAPUs.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
               <span className="text-xs font-semibold text-slate-500 uppercase">Progreso</span>
               <div className="text-lg font-bold text-emerald-600 mt-1">Activo</div>
             </div>
             <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
               <Folder size={20} />
             </div>
          </div>
        </div>
      </div>

      {/* APU List Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-4">
           <Search size={18} className="text-slate-400" />
           <input 
             type="text" 
             placeholder="Buscar concepto..." 
             className="bg-transparent border-none focus:ring-0 text-sm w-full"
           />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 w-32">Código</th>
                <th className="px-6 py-3">Concepto</th>
                <th className="px-6 py-3 w-24 text-center">Unidad</th>
                <th className="px-6 py-3 w-32 text-right">Cantidad</th>
                <th className="px-6 py-3 w-32 text-right">P. Unitario</th>
                <th className="px-6 py-3 w-32 text-right">Total</th>
                <th className="px-6 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {projectAPUs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-slate-100 p-3 rounded-full mb-3">
                         <LayoutGrid className="text-slate-400" size={24} />
                      </div>
                      <p className="mb-2 font-medium text-slate-600">Este proyecto está vacío</p>
                      <button onClick={handleCreateItem} className="text-primary-600 font-bold hover:underline">
                        + Agregar el primer concepto
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                projectAPUs.map((apu) => {
                  const unitPrice = calculateUnitPrice(apu);
                  const totalPrice = unitPrice * apu.quantity;
                  
                  return (
                    <tr 
                      key={apu.id} 
                      onClick={() => handleEditItem(apu.id)}
                      className="border-b last:border-0 hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-slate-600">{apu.code}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {apu.description || <span className="text-slate-400 italic">Sin descripción</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs">{apu.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-right">{apu.quantity.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-slate-600">${unitPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">${totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={(e) => handleDeleteApuClick(e, apu)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors relative z-10"
                              title="Eliminar Rubro"
                            >
                              <Trash2 size={18} />
                            </button>
                            <ArrowRight size={18} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                         </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderEditorView = () => {
    if (!currentEditorAPU) return null;

    return (
      <div className="animate-fade-in-right">
        {/* Editor Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1 cursor-pointer hover:text-primary-600 transition-colors" onClick={handleBackToList}>
              <ChevronLeft size={16} />
              <span className="font-medium">Volver al Presupuesto</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              Editando: <span className="text-primary-600">{currentEditorAPU.code}</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
             <button 
                onClick={(e) => handleDeleteApuClick(e, currentEditorAPU)}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium mr-auto md:mr-0"
             >
               <Trash2 size={18} />
               <span className="hidden sm:inline">Eliminar</span>
             </button>

             <button 
                onClick={() => isOnline && setShowAiModal(true)}
                disabled={!isOnline}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition-all ${
                  isOnline 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600' 
                  : 'bg-slate-400 cursor-not-allowed'
                }`}
             >
                {isOnline ? <Sparkles size={18} /> : <WifiOff size={18} />}
                <span className="hidden sm:inline">Mejorar con IA</span>
             </button>
             <button 
                onClick={handleBackToList}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium shadow-lg shadow-slate-900/10"
             >
                <Save size={18} />
                Guardar
             </button>
          </div>
        </header>

        {/* Editor Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Header Inputs */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Código</label>
                <input 
                  type="text" 
                  value={currentEditorAPU.code}
                  onChange={(e) => updateField('code', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-primary-500 font-mono text-sm"
                />
              </div>
              <div className="md:col-span-6">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Descripción del Concepto</label>
                <input 
                  type="text" 
                  value={currentEditorAPU.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-primary-500 text-sm"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Unidad</label>
                <input 
                  type="text" 
                  value={currentEditorAPU.unit}
                  onChange={(e) => updateField('unit', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-primary-500 text-center font-medium text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-emerald-600 uppercase mb-1">Cant. Proyecto</label>
                <input 
                  type="number" 
                  value={currentEditorAPU.quantity === 0 ? '' : currentEditorAPU.quantity}
                  onChange={(e) => updateField('quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded focus:outline-none focus:border-emerald-500 text-center font-bold text-sm"
                />
              </div>
            </div>

            {/* Resource Tables */}
            <div>
              <ResourceTable 
                resources={currentEditorAPU.resources} 
                type={ResourceType.MATERIAL} 
                onUpdate={updateResources} 
              />
              <ResourceTable 
                resources={currentEditorAPU.resources} 
                type={ResourceType.MANO_DE_OBRA} 
                onUpdate={updateResources} 
              />
              <ResourceTable 
                resources={currentEditorAPU.resources} 
                type={ResourceType.EQUIPO} 
                onUpdate={updateResources} 
              />
              <ResourceTable 
                resources={currentEditorAPU.resources} 
                type={ResourceType.TRANSPORTE} 
                onUpdate={updateResources} 
              />
            </div>
          </div>

          <div className="lg:col-span-1">
             <SummaryCard apu={currentEditorAPU} onUpdate={updateField} />
             <div className="mt-6 flex flex-col gap-3 print:hidden">
                <button 
                  onClick={() => window.print()}
                  className="w-full py-3 border border-slate-300 text-slate-600 font-medium rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                >
                   <Printer size={18} />
                   Imprimir Detalle
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans print:bg-white">
      
      {/* Hidden Input for Import */}
      <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      <input type="file" accept=".json" ref={backupInputRef} onChange={handleImportBackup} className="hidden" />

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col fixed h-full z-10 print:hidden">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-primary-600 p-2 rounded-lg"><HardHat className="text-white" size={24} /></div>
          <span className="font-bold text-white text-lg tracking-tight">ArquiCostos</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => { handleCloseProject(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${!currentProject ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Briefcase size={20} />
            <span className="font-medium">Mis Proyectos</span>
          </button>

          {currentProject && (
             <div className="mt-2 mb-2 px-4">
               <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Proyecto Activo</div>
               <button 
                 className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-lg transition-colors border-l-4 border-primary-500"
               >
                 <Folder size={20} className="text-primary-400" />
                 <span className="font-medium truncate">{currentProject.name}</span>
               </button>
             </div>
          )}
          
          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sistema</div>
          
          <button 
             onClick={() => setShowBackupModal(true)}
             className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 hover:text-white rounded-lg transition-colors text-slate-400"
          >
             <Database size={20} />
             <span className="font-medium">Respaldo y Datos</span>
          </button>

          <button 
             onClick={() => {
               // Only zip source code
               const zip = new JSZip();
               const fileList = [
                'index.html', 'index.tsx', 'App.tsx', 'types.ts',
                'manifest.json', 'service-worker.js', 'metadata.json',
                'components/ResourceTable.tsx', 'components/SummaryCard.tsx',
                'services/geminiService.ts'
               ];
               fileList.forEach(file => {
                 fetch(`./${file}`).then(r => r.text()).then(t => zip.file(file, t));
               });
               setTimeout(() => {
                 zip.generateAsync({type:"blob"}).then(content => {
                   const url = URL.createObjectURL(content);
                   const link = document.createElement('a');
                   link.href = url;
                   link.download = "arquicostos-source.zip";
                   link.click();
                 });
               }, 1000);
             }}
             className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 hover:text-white rounded-lg transition-colors text-emerald-400"
          >
            <Code size={20} /> <span className="font-medium">Descargar Código</span>
          </button>
        </nav>

        {currentProject && (
          <div className="p-4 border-t border-slate-800">
             <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Costo Proyecto</h4>
                <div className="text-xl font-bold text-white">${calculateTotalFromList(projectAPUs).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
             </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto print:ml-0 print:p-0">
        {!isOnline && (
          <div className="mb-6 bg-amber-100 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm print:hidden">
            <WifiOff size={20} /> <span className="text-sm font-bold">Modo Offline</span>
          </div>
        )}

        {/* Dynamic View Rendering */}
        {!currentProject ? renderDashboard() : (editingApuId ? renderEditorView() : renderListView())}
      </main>

      {/* New Project Modal */}
      {isCreatingProject && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Nuevo Proyecto</h3>
                    <input 
                        type="text" 
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Nombre del proyecto"
                        className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-6"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmCreateProject()}
                    />
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setIsCreatingProject(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirmCreateProject}
                            disabled={!newProjectName.trim()}
                            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Crear Proyecto
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" onClick={() => setProjectToDelete(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">¿Eliminar Proyecto?</h3>
              <p className="text-slate-500 mb-6">
                Estás a punto de eliminar <span className="font-bold text-slate-800">{projectToDelete.name}</span>. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => setProjectToDelete(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmDeleteProject}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete APU Modal */}
      {apuToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" onClick={() => setApuToDelete(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">¿Eliminar Concepto?</h3>
              <p className="text-slate-500 mb-6">
                Estás a punto de eliminar <span className="font-bold text-slate-800">{apuToDelete.code}</span>. <br/>
                <span className="text-xs text-slate-400 italic">"{apuToDelete.description.substring(0, 50)}..."</span><br/>
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => setApuToDelete(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmDeleteApu}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Backup / Data Management Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" onClick={() => setShowBackupModal(false)}>
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="bg-primary-100 p-2 rounded-lg text-primary-600">
                      <Database size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Respaldo y Datos</h3>
                      <p className="text-sm text-slate-500">Gestiona el almacenamiento de tus proyectos</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                       <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-2">
                          <Download size={16} /> Crear Copia de Seguridad
                       </h4>
                       <p className="text-sm text-slate-500 mb-3">
                          Descarga un archivo con <strong>todos</strong> tus proyectos actuales. Guarda este archivo en un lugar seguro.
                       </p>
                       <button 
                          onClick={handleExportAllData}
                          className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                       >
                          Descargar Todo
                       </button>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                       <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-2">
                          <UploadCloud size={16} /> Restaurar Copia
                       </h4>
                       <p className="text-sm text-slate-500 mb-3">
                          Recupera tus proyectos subiendo un archivo de respaldo.
                       </p>
                       <button 
                          onClick={() => backupInputRef.current?.click()}
                          className="w-full py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors"
                       >
                          Seleccionar Archivo
                       </button>
                    </div>
                 </div>
                 
                 <div className="mt-6 flex items-start gap-2 bg-amber-50 p-3 rounded-lg border border-amber-100 text-amber-800 text-xs">
                    <AlertTriangle size={32} className="shrink-0" />
                    <p>Nota: Los datos se guardan en este navegador. Si borras el historial o cambias de dispositivo, perderás tus proyectos a menos que hayas creado una copia de seguridad.</p>
                 </div>

                 <div className="mt-6 flex justify-end">
                    <button 
                       onClick={() => setShowBackupModal(false)}
                       className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                    >
                       Cerrar
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles size={20} />
                {editingApuId ? 'Mejorar Concepto' : 'Nuevo Concepto IA'}
              </h3>
              <p className="text-purple-100 text-sm mt-1">
                Describe el concepto constructivo y generaré los recursos necesarios.
              </p>
            </div>
            
            <div className="p-6">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej: Losa de concreto armado de 10cm, fc=250kg/cm2 con malla electrosoldada..."
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-slate-700"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowAiModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
                <button 
                  onClick={handleAiGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? 'Analizando...' : 'Generar'} <Sparkles size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;