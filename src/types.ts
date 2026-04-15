export interface Product {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  created_at: string;
  updated_at?: string;
}

export type ScanResult = {
  success: boolean;
  message: string;
  product?: Product;
};
