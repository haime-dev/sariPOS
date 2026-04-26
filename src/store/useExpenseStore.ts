import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  user_id?: string;
  transaction_id?: string;
}

interface ExpenseStore {
  expenses: Expense[];
  fetchExpenses: () => Promise<void>;
  cleanupOrphanedExpenses: () => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  removeExpensesByTransactionId: (transactionId: string) => void;
  removeExpensesByDate: (date: string) => void;
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  expenses: [],
  fetchExpenses: async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching expenses:', error.message);
      return;
    }
    
    if (data) {
      set({ expenses: data as Expense[] });
    }
  },
  cleanupOrphanedExpenses: async () => {
    // Fetch store use expenses
    const { data: storeUseExpenses } = await supabase
      .from('expenses')
      .select('id, transaction_id, date')
      .eq('category', 'Store Use');

    if (!storeUseExpenses || storeUseExpenses.length === 0) return;

    // Fetch matching transaction identifiers
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, date');

    if (!transactions) return;

    const validTxIds = new Set(transactions.map(t => t.id));
    const validTxDates = new Set(transactions.map(t => t.date));

    const orphanedIds = storeUseExpenses.filter(exp => {
      if (exp.transaction_id) return !validTxIds.has(exp.transaction_id);
      return !validTxDates.has(exp.date);
    }).map(exp => exp.id);

    if (orphanedIds.length > 0) {
      await supabase.from('expenses').delete().in('id', orphanedIds);
      set((state) => ({ expenses: state.expenses.filter(e => !orphanedIds.includes(e.id)) }));
    }
  },
  addExpense: async (expense) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert([expense])
      .select()
      .single();
      
    if (error) {
      console.error('Error adding expense:', error.message);
      return;
    }
    
    if (data) {
      set((state) => ({ expenses: [data as Expense, ...state.expenses] }));
    }
  },
  deleteExpense: async (id) => {
    const expenseToDelete = get().expenses.find((e: any) => e.id === id);
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting expense:', error.message);
      return;
    }
    
    if (expenseToDelete) {
      const { useTransactionStore } = await import('./useTransactionStore');
      await useTransactionStore.getState().logTransactionAction('Expense Deleted', id, JSON.stringify({
        message: `Expense ${id} (${expenseToDelete.description}) was deleted.`,
        expense: expenseToDelete
      }));
    }
    
    set((state) => ({ expenses: state.expenses.filter(e => e.id !== id) }));
  },
  removeExpensesByTransactionId: (transactionId) => 
    set((state) => ({ expenses: state.expenses.filter(e => e.transaction_id !== transactionId) })),
  removeExpensesByDate: (date) => 
    set((state) => ({ expenses: state.expenses.filter(e => e.date !== date) }))
}));
