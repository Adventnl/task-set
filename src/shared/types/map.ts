export interface Place { name: string; latitude: number; longitude: number }
interface MapRecord { id: string; createdAt: string; updatedAt: string; deletedAt: string | null }
export interface MapCategory extends MapRecord { name: string; color: string }
export interface MapPin extends MapRecord, Place { categoryId: string; note: string }
