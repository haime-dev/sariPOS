import { create } from 'zustand';
import { Product } from './useCartStore';
import { supabase } from '../lib/supabase';

export interface InventoryItem extends Product {

  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

interface InventoryStore {
  items: InventoryItem[];
  fetchItems: () => Promise<void>;
  addItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, updatedFields: Partial<InventoryItem>) => Promise<void>;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  items: [],
  fetchItems: async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching inventory:', error.message);
      return;
    }
    
    if (data) {
      set({ items: data as InventoryItem[] });
    }
  },
  addItem: async (item) => {
    const { data, error } = await supabase
      .from('products')
      .insert([item])
      .select()
      .single();
      
    if (error) {
      console.error('Error adding product:', error.message);
      return;
    }
    
    if (data) {
      set((state) => ({ items: [data as InventoryItem, ...state.items] }));
    }
  },
  removeItem: async (id) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting product:', error.message);
      return;
    }
    
    set((state) => ({ items: state.items.filter(i => i.id !== id) }));
  },
  updateItem: async (id, updatedFields) => {
    const { data, error } = await supabase
      .from('products')
      .update(updatedFields)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Error updating product:', error.message);
      return;
    }
    
    if (data) {
      set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, ...data } : i)
      }));
    }
  }
}));
