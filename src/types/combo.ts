export interface ComboRequirement {
  category: string;
  quantity: number;
}

export interface Combo {
  id?: string;
  name: string;
  price: number;              // USD
  bolivarPrice?: number;      // EUR ref
  requirements: ComboRequirement[];
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface AppliedCombo {
  comboId: string;
  quantity: number;
}
