import { create } from 'zustand';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  original_price?: number;
  original_price_at_time?: number;
  image?: string;
  stock: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  isExpense?: boolean;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleExpense: (productId: string) => void;
  markAllAsExpense: (isExpense: boolean) => void;
  // tax can be added here
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (product) => set((state) => {
    const existingItem = state.items.find((item) => item.product.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        return state;
      }
      return {
        items: state.items.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
      };
    }
    
    if (product.stock <= 0) {
      return state;
    }
    
    return { items: [...state.items, { product, quantity: 1 }] };
  }),
  removeItem: (productId) => set((state) => ({
    items: state.items.filter((item) => item.product.id !== productId),
  })),
  updateQuantity: (productId, quantity) => set((state) => {
    const item = state.items.find(i => i.product.id === productId);
    if (!item) return state;

    if (quantity > item.product.stock) {
      return state;
    }

    return {
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity: Math.max(0, quantity) } : item
      ).filter(item => item.quantity > 0),
    };
  }),
  clearCart: () => set({ items: [] }),
  toggleExpense: (productId) => set((state) => ({
    items: state.items.map((item) =>
      item.product.id === productId ? { ...item, isExpense: !item.isExpense } : item
    )
  })),
  markAllAsExpense: (isExpense) => set((state) => ({
    items: state.items.map((item) => ({ ...item, isExpense }))
  })),
}));
