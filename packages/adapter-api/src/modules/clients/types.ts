export interface Client {
    id: number;
    name: string;
    userId?: string | null;
    email?: string | null;
    company: string;
    department: string;
    website: string;
    description: string;
    location: string;
    languages: string[];
    createdAt: number;
    updatedAt: number;
  }

export interface CreateClientRequest {
    userId?: string;
    email?: string;
    name: string;
    company: string;
    department: string;
    website: string;
    description: string;
    location: string;
    languages?: string[];
    image?: File; // multipart/form-data
  }
  
  export interface UpdateClientRequest {
    userId?: string;
    email?: string;
    name?: string;
    company?: string;
    department?: string;
    website?: string;
    description?: string;
    location?: string;
    languages?: string[];
    image?: File; // multipart/form-data
  }
