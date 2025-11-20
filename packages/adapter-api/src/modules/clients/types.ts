export interface Client {
    id: number;
    name: string;
    email: string;
    company: string;
    department: string;
    website: string;
    description: string;
    location: string;
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
    image?: File; // multipart/form-data
  }
  
  export interface UpdateClientRequest {
    email?: string;
    name?: string;
    company?: string;
    department?: string;
    website?: string;
    description?: string;
    location?: string;
    image?: File; // multipart/form-data
  }