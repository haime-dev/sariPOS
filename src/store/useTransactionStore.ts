import { create } from 'zustand';
import { CartItem } from './useCartStore';
import { useExpenseStore } from './useExpenseStore';
import { supabase } from '../lib/supabase';

export interface Transaction {
  id: string;
  date: string;
  customer: string;
  status: 'Done' | 'Pending' | 'Cancelled';
  total: number;
  amount_paid: number;
  payment: 'Paid' | 'Unpaid' | 'Partially Paid';
  items: CartItem[];
}

export interface TransactionHistory {
  id: string;
  transaction_id: string;
  action: string;
  details: string;
  created_at: string;
  user_id: string;
}

interface TransactionStore {
  transactions: Transaction[];
  transactionHistory: TransactionHistory[];
  fetchTransactions: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  logTransactionAction: (action: string, transactionId: string, details: string) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => Promise<Transaction | undefined>;
  reverseTransaction: (transactionId: string) => Promise<void>;
  updateTransactionPayment: (transactionId: string, payment: 'Paid' | 'Unpaid' | 'Partially Paid', amount_paid: number) => Promise<void>;
  updateTransactionPricing: (transactionId: string, updatedItems: CartItem[], newTotal: number, newAmountPaid: number) => Promise<void>;
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  transactionHistory: [],
  fetchTransactions: async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items (
          quantity,
          price_at_time,
          original_price_at_time,
          products (*)
        )
      `)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }

    if (data) {
      const mappedTransactions: Transaction[] = data.map((t: any) => ({
        id: t.id,
        date: t.date,
        customer: t.customer,
        status: t.status,
        total: t.total,
        amount_paid: t.payment === 'Paid' || !t.payment ? t.total : (t.payment === 'Unpaid' ? 0 : Number(t.amount_paid || 0)),
        payment: t.payment || 'Paid',
        items: t.transaction_items.map((ti: any) => ({
          product: {
            ...ti.products,
            price: ti.price_at_time,
            original_price_at_time: ti.original_price_at_time
          },
          quantity: ti.quantity
        }))
      }));

      set({ transactions: mappedTransactions });
    }
  },
  fetchHistory: async () => {
    const { data, error } = await supabase
      .from('transaction_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      return;
    }

    if (data) {
      set({ transactionHistory: data as TransactionHistory[] });
    }
  },
  logTransactionAction: async (action, transactionId, details) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) return;

    const { data, error } = await supabase
      .from('transaction_history')
      .insert([{
        action,
        transaction_id: transactionId,
        details,
        user_id: userId
      }])
      .select()
      .single();

    if (error) {
      console.error('Error logging transaction action:', error);
      return;
    }
    
    set((state) => ({
      transactionHistory: [data as TransactionHistory, ...state.transactionHistory]
    }));
  },
  addTransaction: async (transaction) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      console.error('User not authenticated, cannot save transaction.');
      return;
    }

    const { data: newTx, error: txError } = await supabase
      .from('transactions')
      .insert([{
        customer: transaction.customer,
        status: transaction.status,
        payment: transaction.payment,
        total: transaction.total,
        amount_paid: transaction.amount_paid,
        user_id: userId
      }])
      .select()
      .single();

    if (txError || !newTx) {
      console.error('Error creating transaction:', txError);
      return;
    }

    if (transaction.items && transaction.items.length > 0) {
      const itemsToInsert = transaction.items.map(item => ({
        transaction_id: newTx.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_time: item.isExpense ? 0 : item.product.price,
        original_price_at_time: item.product.original_price || 0
      }));

      const expensesToInsert = transaction.items
        .filter(item => item.isExpense)
        .map(item => ({
          description: `Store Use: ${item.product.name}`,
          category: 'Store Use',
          amount: (item.product.original_price || 0) * item.quantity,
          date: newTx.date,
          user_id: userId,
          transaction_id: newTx.id
        }));

      if (expensesToInsert.length > 0) {
        await supabase.from('expenses').insert(expensesToInsert);
      }

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Error adding transaction items:', itemsError);
      } else {
        // Update product stock levels
        for (const item of transaction.items) {
          const newStock = Math.max(0, item.product.stock - item.quantity);
          const newStatus = newStock <= 0 ? 'Out of Stock' : newStock < 10 ? 'Low Stock' : 'In Stock';
          
          await supabase
            .from('products')
            .update({ stock: newStock, status: newStatus })
            .eq('id', item.product.id);
        }
      }
    }

    set((state) => {
      const fullTransaction: Transaction = {
        ...transaction,
        id: newTx.id,
        date: newTx.date,
      };
      return { transactions: [fullTransaction, ...state.transactions] };
    });
    
    // Log the action
    await get().logTransactionAction('Order Placed', newTx.id, `Order for ${transaction.customer} totaling ${transaction.total} placed.`);
    
    return { ...transaction, id: newTx.id, date: newTx.date };
  },
  reverseTransaction: async (transactionId) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user?.id) return;

    // Get the transaction details to restore stock
    const transactionToReverse = useTransactionStore.getState().transactions.find(t => t.id === transactionId);
    
    if (transactionToReverse && transactionToReverse.items) {
      // Restore product stock levels
      for (const item of transactionToReverse.items) {
        // Fetch current stock to determine new stock accurately
        const { data: productData } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product.id)
          .single();
          
        if (productData) {
          const newStock = productData.stock + item.quantity;
          const newStatus = newStock <= 0 ? 'Out of Stock' : newStock < 10 ? 'Low Stock' : 'In Stock';
          
          await supabase
            .from('products')
            .update({ stock: newStock, status: newStatus })
            .eq('id', item.product.id);
        }
      }
    }

    // Explicitly delete expenses tied to this transaction
    await supabase.from('expenses').delete().eq('transaction_id', transactionId);
    useExpenseStore.getState().removeExpensesByTransactionId(transactionId);

    // Fallback for older data before transaction_id was added
    if (transactionToReverse) {
      await supabase.from('expenses').delete().eq('date', transactionToReverse.date).eq('category', 'Store Use');
      useExpenseStore.getState().removeExpensesByDate(transactionToReverse.date);
    }

    // Delete the transaction (cascade delete should handle transaction_items)
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) {
      console.error('Error reversing transaction:', error);
      return;
    }

    // Update local state
    set((state) => ({
      transactions: state.transactions.filter(t => t.id !== transactionId)
    }));

    // Log the undo action
    await get().logTransactionAction('Order Undone', transactionId, JSON.stringify({
      message: `Order ${transactionId} was reverted and stock was restored.`,
      transaction: transactionToReverse
    }));
  },
  updateTransactionPayment: async (transactionId, payment, amount_paid) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user?.id) return;

    // Update in Supabase
    const { error } = await supabase
      .from('transactions')
      .update({ payment, amount_paid: amount_paid.toString() })
      .eq('id', transactionId);

    if (error) {
      console.error('Error updating transaction payment:', error);
      return;
    }

    // Update locally
    set((state) => ({
      transactions: state.transactions.map((t) => 
        t.id === transactionId ? { ...t, payment, amount_paid } : t
      )
    }));

    // Log the update action
    await get().logTransactionAction('Payment Updated', transactionId, `Updated payment to ${payment} (${amount_paid}) for order ${transactionId}`);
  },
  updateTransactionPricing: async (transactionId, updatedItems, newTotal, newAmountPaid) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user?.id) return;

    // Update in Supabase - transactions table
    const { error: txError } = await supabase
      .from('transactions')
      .update({ total: newTotal, amount_paid: newAmountPaid.toString() })
      .eq('id', transactionId);

    if (txError) {
      console.error('Error updating transaction pricing:', txError);
      return;
    }

    // Update transaction_items table
    for (const item of updatedItems) {
      await supabase
        .from('transaction_items')
        .update({
          price_at_time: item.product.price,
          original_price_at_time: item.product.original_price || 0
        })
        .eq('transaction_id', transactionId)
        .eq('product_id', item.product.id);
    }

    // Update locally
    set((state) => ({
      transactions: state.transactions.map((t) => 
        t.id === transactionId ? { 
          ...t, 
          total: newTotal, 
          amount_paid: newAmountPaid,
          items: t.items.map(ti => {
            const matchedItem = updatedItems.find(ni => ni.product.id === ti.product.id);
            if (matchedItem) {
              return {
                ...ti,
                product: {
                  ...ti.product,
                  price: matchedItem.product.price,
                  original_price_at_time: matchedItem.product.original_price || 0
                }
              };
            }
            return ti;
          })
        } : t
      )
    }));

    // Log the update action
    await get().logTransactionAction('Pricing Updated', transactionId, `Updated pricing for order ${transactionId} to latest inventory prices. New Total: ${newTotal}`);
  },
}));
