export type TripCategory = "Trekking" | "Hiking" | "Camping" | "Adventure";
export type TripDifficulty = "Easy" | "Moderate" | "Challenging";

export type Trip = {
  id: string;
  title: string;
  destination: string;
  category: TripCategory;
  duration: string;
  priceMmk: number;
  difficulty: TripDifficulty;
  organizer: string;
  imageUrl: string;
  imageDescription: string;
};
