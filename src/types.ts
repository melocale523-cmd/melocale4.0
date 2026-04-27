export interface Professional {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewsCount: number;
  location: string;
  description: string;
  priceStarting: number;
  imageUrl: string;
  featured?: boolean;
  specialties: string[];
}
