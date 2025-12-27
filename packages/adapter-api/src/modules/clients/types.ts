export interface Client {
    id: number;
    name: string;
    email: string;
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
    email: string;
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
    name?: string;
    company?: string;
    department?: string;
    website?: string;
    description?: string;
    location?: string;
    languages?: string[];
    image?: File; // multipart/form-data
  }