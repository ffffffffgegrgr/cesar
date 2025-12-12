export enum ResourceType {
  MATERIAL = 'Material',
  MANO_DE_OBRA = 'Mano de Obra',
  EQUIPO = 'Equipo/Herramienta',
  TRANSPORTE = 'Transporte/Fletes',
}

export interface Resource {
  id: string;
  name: string;
  unit: string;
  price: number; // Costo unitario del recurso
  quantity: number; // Cantidad o Rendimiento
  type: ResourceType;
}

export interface APU {
  id: string;
  code: string;
  description: string;
  unit: string; // Unidad del concepto (m2, m3, pza)
  quantity: number; // Cantidad total en el proyecto (ej: 500 m2)
  resources: Resource[];
  indirectsPercentage: number;
  profitPercentage: number;
  category: string; // e.g., 'Cimentación', 'Muros', 'Acabados'
}

export interface Project {
  id: string;
  name: string;
  lastModified: number;
  apus: APU[];
  location?: string;
  client?: string;
}

export interface ProjectStats {
  totalDirectCost: number;
  totalPrice: number;
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  transportCost: number;
}