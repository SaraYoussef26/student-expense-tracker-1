import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('All'); 
  const [editingExpense, setEditingExpense] = useState(null);

  const loadExpenses = async () => {
    const rows = await db.getAllAsync('SELECT * FROM expenses ORDER BY id DESC;');
    setExpenses(rows);
  };

  const filteredExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    const now = new Date();

    if (filter === 'All') return true;

    if (filter === 'This Week') {
      const firstDayOfWeek = new Date(now);
      firstDayOfWeek.setDate(now.getDate() - now.getDay());
      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
      return expenseDate >= firstDayOfWeek && expenseDate <= lastDayOfWeek;
    }

    if (filter === 'This Month') {
      return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
    }

    return true;
  });

  const totalAmount = filteredExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const totalsByCategory = {};
  filteredExpenses.forEach(e => {
    totalsByCategory[e.category] = (totalsByCategory[e.category] || 0) + Number(e.amount);
  });

  const saveExpense = async () => {
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) return;

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();
    if (!trimmedCategory) return;

    const today = new Date().toISOString().split('T')[0];

    if (editingExpense) {
      await db.runAsync(
        'UPDATE expenses SET amount = ?, category = ?, note = ?, date = ? WHERE id = ?;',
        [amountNumber, trimmedCategory, trimmedNote || null, editingExpense.date, editingExpense.id]
      );
      setEditingExpense(null);
    } else {
      await db.runAsync(
        'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
        [amountNumber, trimmedCategory, trimmedNote || null, today]
      );
    }

    setAmount('');
    setCategory('');
    setNote('');
    loadExpenses();
  };

  const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };

  useEffect(() => {
    if (editingExpense) {
      setAmount(editingExpense.amount.toString());
      setCategory(editingExpense.category);
      setNote(editingExpense.note || '');
    }
  }, [editingExpense]);

  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        <Text style={styles.expenseDate}>{item.date}</Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => setEditingExpense(item)}>
          <Text style={styles.edit}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteExpense(item.id)}>
          <Text style={styles.delete}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT NOT NULL
        );
      `);
      await loadExpenses();
    }
    setup();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

      {/* Filters */}
      <View style={styles.filterRow}>
        {['All', 'This Week', 'This Month'].map(f => (
          <Button key={f} title={f} onPress={() => setFilter(f)} color={filter === f ? '#3b82f6' : '#6b7280'} />
        ))}
      </View>

      {/* Totals */}
      <Text style={styles.total}>Total ({filter}): ${totalAmount.toFixed(2)}</Text>
      {Object.keys(totalsByCategory).length > 0 && (
        <View style={styles.byCategory}>
          {Object.entries(totalsByCategory).map(([cat, amt]) => (
            <Text key={cat} style={styles.categoryTotal}>{cat}: ${amt.toFixed(2)}</Text>
          ))}
        </View>
      )}

      {/* Expense Form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Amount (e.g. 12.50)"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (Food, Books, Rent...)"
          placeholderTextColor="#9ca3af"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
        />
        <Button title={editingExpense ? "Save Changes" : "Add Expense"} onPress={saveExpense} />
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
      />

      <Text style={styles.footer}>
        Enter your expenses and they’ll be saved locally with SQLite.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
});