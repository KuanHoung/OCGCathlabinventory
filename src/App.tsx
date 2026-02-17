import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import { 
  LayoutDashboard, 
  Scan, 
  Database, 
  History, 
  ShoppingCart, 
  Plus, 
  Minus, 
  AlertTriangle, 
  Search, 
  Save, 
  Trash2, 
  FileText, 
  Archive, 
  Unlock, 
  Lock,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  Truck,
  Activity,
  Filter,
  Calendar,
  Eye,
  FileBox,
  Edit3,
  XCircle,
  Check
} from 'lucide-react';

const firebaseConfig = {
    apiKey: "AIzaSyCkNm31-h9x4FvuFVRHFyIo9lYER5_LCzc",
    authDomain: "ocg-cathlab-inventory.firebaseapp.com",
    projectId: "ocg-cathlab-inventory",
    storageBucket: "ocg-cathlab-inventory.firebasestorage.app",
    messagingSenderId: "925671060283",
    appId: "1:925671060283:web:6ed17cdb4f3c36a5f7fd1e",
    measurementId: "G-SG2ZSF8K7F"
  };
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

// --- Utility Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getDaysDifference = (dateStr) => {
  if (!dateStr) return 9999;
  const target = new Date(dateStr);
  const now = new Date();
  const diffTime = target - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

// --- Mock Data Generators (for initial load) ---

const INITIAL_ITEMS = [
  { gtin: '00123456789012', ref: 'CX-202', name: 'Coronary Stent Drug-Eluting 3.0mm', vendor: 'MedDevice Co', par: 10, status: 'active' },
  { gtin: '00987654321098', ref: 'GW-001', name: 'Guide Wire 0.014"', vendor: 'CardioSupply', par: 25, status: 'active' },
  { gtin: '00555555555555', ref: 'BC-5F', name: 'Balloon Catheter 5F', vendor: 'MedDevice Co', par: 15, status: 'active' },
  { gtin: '00111122223333', ref: 'INTRO-6F', name: 'Introducer Sheath 6F', vendor: 'Vascular Sol', par: 20, status: 'active' },
];

// --- Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, color = "gray" }) => {
  const colors = {
    gray: "bg-gray-100 text-gray-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800",
    orange: "bg-orange-100 text-orange-800",
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
};

// --- Extracted Ledger View to prevent re-render issues ---
const LedgerView = ({ transactions, setTransactions }) => {
    const [search, setSearch] = useState('');
    const [auditorMode, setAuditorMode] = useState(false);
    
    // Staging state for Auditor Mode
    const [pendingChanges, setPendingChanges] = useState({}); // { txId: { quantity: val, expiryDate: val } }
    
    // Filters
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filterTypes, setFilterTypes] = useState({ receive: true, use: true, adjust: true });
    const [groupByItem, setGroupByItem] = useState(false);

    const filteredTx = useMemo(() => {
        return transactions.filter(t => {
            // Text Search
            const matchesSearch = t.itemName.toLowerCase().includes(search.toLowerCase()) || 
                                  t.gtin.includes(search) ||
                                  (t.caseId && t.caseId.toLowerCase().includes(search.toLowerCase()));
            
            // Date Filter
            let matchesDate = true;
            const txDate = new Date(t.timestamp);
            
            if (dateRange.start) {
                // Manually construct local date to avoid UTC interpretation issues
                const [sy, sm, sd] = dateRange.start.split('-').map(Number);
                const startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
                matchesDate = matchesDate && txDate >= startDate;
            }
            if (dateRange.end) {
                // Manually construct local date to end of day
                const [ey, em, ed] = dateRange.end.split('-').map(Number);
                const endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
                matchesDate = matchesDate && txDate <= endDate;
            }

            // Type Filter
            const matchesType = filterTypes[t.type];

            return matchesSearch && matchesDate && matchesType;
        }).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [transactions, search, dateRange, filterTypes]);

    const groupedData = useMemo(() => {
        if (!groupByItem) return [];
        const groups = {};
        
        filteredTx.forEach(tx => {
            if (!groups[tx.gtin]) {
                groups[tx.gtin] = {
                    gtin: tx.gtin,
                    itemName: tx.itemName,
                    received: 0,
                    used: 0,
                    adjusted: 0
                };
            }
            const qty = parseInt(tx.quantity);
            if (tx.type === 'receive') groups[tx.gtin].received += qty;
            else if (tx.type === 'use') groups[tx.gtin].used += Math.abs(qty); 
            else if (tx.type === 'adjust') groups[tx.gtin].adjusted += qty;
        });
        return Object.values(groups);
    }, [filteredTx, groupByItem]);

    const handleDeleteTx = (id) => {
        if (window.confirm("Are you sure? This will permanently affect stock levels.")) {
            setTransactions(transactions.filter(t => t.id !== id));
        }
    };

    // Stage changes locally
    const handleStageChange = (id, field, value) => {
        setPendingChanges(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || {}),
                [field]: value
            }
        }));
    };

    // Commit changes to global state
    const handleSaveChanges = () => {
        const count = Object.keys(pendingChanges).length;
        if (count === 0) {
            setAuditorMode(false);
            return;
        }

        if (window.confirm(`Are you sure you want to update ${count} transaction records?\nThis will modify historical data.`)) {
            const updatedTransactions = transactions.map(tx => {
                if (pendingChanges[tx.id]) {
                    return { ...tx, ...pendingChanges[tx.id] };
                }
                return tx;
            });
            setTransactions(updatedTransactions);
            setPendingChanges({});
            setAuditorMode(false);
        }
    };

    const handleCancelAuditor = () => {
        if (Object.keys(pendingChanges).length > 0) {
            if (!window.confirm("You have unsaved changes. Discard them and exit?")) return;
        }
        setPendingChanges({});
        setAuditorMode(false);
    };

    return (
        <div className="space-y-4">
             {/* Controls */}
             <div className="bg-white p-4 rounded shadow-sm space-y-4 border-l-4 border-gray-400">
                 <div className="flex flex-wrap items-center justify-between gap-4">
                     {/* Search */}
                     <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                            className="w-full pl-9 pr-4 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" 
                            placeholder="Search by item, GTIN, or Case ID..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                     </div>

                     {/* Auditor Mode Toggle */}
                     <div className="flex items-center gap-2">
                         {auditorMode ? (
                             <div className="flex items-center gap-2">
                                 <button 
                                    onClick={handleCancelAuditor}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-medium"
                                 >
                                     <XCircle size={16} /> Cancel
                                 </button>
                                 <button 
                                    onClick={handleSaveChanges}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium shadow-sm"
                                 >
                                     <Check size={16} /> Save Changes
                                 </button>
                             </div>
                         ) : (
                             <button 
                                onClick={() => setAuditorMode(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded text-sm font-medium transition-colors"
                             >
                                 <Edit3 size={16} /> Enable Auditor Mode
                             </button>
                         )}
                     </div>
                 </div>

                 <div className="flex flex-wrap gap-6 border-t pt-4">
                     {/* Date Range */}
                     <div className="flex items-center gap-2 text-sm">
                         <Calendar size={16} className="text-gray-500"/>
                         <span className="font-medium text-gray-700">Range:</span>
                         <input 
                            type="date" 
                            className="border rounded px-2 py-1 text-gray-600"
                            value={dateRange.start}
                            onChange={e => setDateRange({...dateRange, start: e.target.value})}
                         />
                         <span className="text-gray-400">to</span>
                         <input 
                            type="date" 
                            className="border rounded px-2 py-1 text-gray-600"
                            value={dateRange.end}
                            onChange={e => setDateRange({...dateRange, end: e.target.value})}
                         />
                     </div>

                     {/* Type Filters */}
                     <div className="flex items-center gap-4 text-sm">
                         <Filter size={16} className="text-gray-500"/>
                         <span className="font-medium text-gray-700">Include:</span>
                         <label className="flex items-center gap-1 cursor-pointer">
                             <input 
                                type="checkbox" 
                                checked={filterTypes.receive} 
                                onChange={e => setFilterTypes({...filterTypes, receive: e.target.checked})}
                                className="rounded text-green-600"
                             />
                             <span className="text-gray-600">Receive</span>
                         </label>
                         <label className="flex items-center gap-1 cursor-pointer">
                             <input 
                                type="checkbox" 
                                checked={filterTypes.use} 
                                onChange={e => setFilterTypes({...filterTypes, use: e.target.checked})}
                                className="rounded text-red-600"
                             />
                             <span className="text-gray-600">Use</span>
                         </label>
                         <label className="flex items-center gap-1 cursor-pointer">
                             <input 
                                type="checkbox" 
                                checked={filterTypes.adjust} 
                                onChange={e => setFilterTypes({...filterTypes, adjust: e.target.checked})}
                                className="rounded text-blue-600"
                             />
                             <span className="text-gray-600">Adjust</span>
                         </label>
                     </div>

                     {/* Group Toggle */}
                     <div className="flex items-center gap-2 text-sm border-l pl-6">
                         <input 
                            type="checkbox" 
                            id="groupBy"
                            checked={groupByItem} 
                            onChange={e => setGroupByItem(e.target.checked)}
                            className="rounded text-blue-600"
                         />
                         <label htmlFor="groupBy" className="font-medium text-gray-700 cursor-pointer">Group & Total by Item</label>
                     </div>
                 </div>
             </div>

             <Card className="overflow-x-auto">
                 {groupByItem ? (
                     // Grouped Table
                     <table className="w-full text-left text-sm whitespace-nowrap">
                         <thead className="bg-gray-100 text-gray-600">
                             <tr>
                                 <th className="p-3">Item Name</th>
                                 <th className="p-3">GTIN</th>
                                 <th className="p-3 text-center text-green-700">Total Received</th>
                                 <th className="p-3 text-center text-red-700">Total Used</th>
                                 <th className="p-3 text-center text-blue-700">Net Adjusted</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y">
                             {groupedData.length === 0 ? (
                                 <tr><td colSpan="5" className="p-4 text-center text-gray-500">No records found for this range.</td></tr>
                             ) : (
                                 groupedData.map(group => (
                                     <tr key={group.gtin} className="hover:bg-gray-50">
                                         <td className="p-3 font-medium text-gray-900">{group.itemName}</td>
                                         <td className="p-3 text-gray-500 font-mono text-xs">{group.gtin}</td>
                                         <td className="p-3 text-center font-bold text-green-600">+{group.received}</td>
                                         <td className="p-3 text-center font-bold text-red-600">-{group.used}</td>
                                         <td className="p-3 text-center font-bold text-blue-600">
                                             {group.adjusted > 0 ? '+' : ''}{group.adjusted}
                                         </td>
                                     </tr>
                                 ))
                             )}
                         </tbody>
                     </table>
                 ) : (
                     // Standard Ledger Table
                     <table className="w-full text-left text-sm whitespace-nowrap">
                         <thead className="bg-gray-50 text-gray-500">
                             <tr>
                                 <th className="p-3">Date/Time</th>
                                 <th className="p-3">Type</th>
                                 <th className="p-3">Item</th>
                                 <th className="p-3 text-center">Qty</th>
                                 <th className="p-3">Expiry</th>
                                 <th className="p-3">Context (Case/Reason)</th>
                                 {auditorMode && <th className="p-3 text-right">Admin</th>}
                             </tr>
                         </thead>
                         <tbody className="divide-y">
                             {filteredTx.length === 0 ? (
                                 <tr><td colSpan="7" className="p-4 text-center text-gray-500">No records found.</td></tr>
                             ) : (
                                 filteredTx.map(tx => {
                                     // Check for pending edits
                                     const pending = pendingChanges[tx.id] || {};
                                     const currentQty = pending.quantity !== undefined ? pending.quantity : tx.quantity;
                                     const currentExpiry = pending.expiryDate !== undefined ? pending.expiryDate : (tx.expiryDate || '');
                                     const isModified = pendingChanges[tx.id] !== undefined;

                                     return (
                                     <tr key={tx.id} className={`hover:bg-gray-50 ${isModified ? 'bg-blue-50/50' : ''}`}>
                                         <td className="p-3 text-gray-500">
                                             {new Date(tx.timestamp).toLocaleString()}
                                         </td>
                                         <td className="p-3">
                                             <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold
                                                ${tx.type === 'receive' ? 'bg-green-100 text-green-800' : ''}
                                                ${tx.type === 'use' ? 'bg-red-100 text-red-800' : ''}
                                                ${tx.type === 'adjust' ? 'bg-blue-100 text-blue-800' : ''}
                                             `}>
                                                 {tx.type}
                                             </span>
                                         </td>
                                         <td className="p-3">
                                             <div className="font-medium">{tx.itemName}</div>
                                             <div className="text-xs text-gray-400">{tx.gtin}</div>
                                         </td>
                                         <td className={`p-3 text-center font-bold ${currentQty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                             {auditorMode ? (
                                                 <input 
                                                    type="number" 
                                                    value={currentQty}
                                                    onChange={(e) => handleStageChange(tx.id, 'quantity', parseInt(e.target.value) || 0)}
                                                    className={`w-20 p-1 border rounded text-center text-sm font-mono focus:ring-2 outline-none ${pending.quantity !== undefined ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-300 focus:ring-blue-500'}`}
                                                 />
                                             ) : (
                                                 <span>{tx.quantity > 0 ? '+' : ''}{tx.quantity}</span>
                                             )}
                                         </td>
                                         <td className="p-3 text-gray-600">
                                             {auditorMode ? (
                                                 <input 
                                                    type="date" 
                                                    value={currentExpiry}
                                                    onChange={(e) => handleStageChange(tx.id, 'expiryDate', e.target.value)}
                                                    className={`w-32 p-1 border rounded text-sm font-mono focus:ring-2 outline-none ${pending.expiryDate !== undefined ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-300 focus:ring-blue-500'}`}
                                                    required
                                                 />
                                             ) : (
                                                 tx.expiryDate || '-'
                                             )}
                                         </td>
                                         <td className="p-3 text-gray-600 italic">
                                             {tx.caseId ? `Case: ${tx.caseId}` : (tx.reason ? `Reason: ${tx.reason}` : '-')}
                                         </td>
                                         {auditorMode && (
                                             <td className="p-3 text-right">
                                                 <button onClick={() => handleDeleteTx(tx.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                                     <Trash2 size={16} />
                                                 </button>
                                             </td>
                                         )}
                                     </tr>
                                 )})
                             )}
                         </tbody>
                     </table>
                 )}
             </Card>
        </div>
    );
};

export default function CathLabInventory() {
  // --- State ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- NEW CLOUD LOGIC ---

  // 1. LISTEN: Connect to Google and pull data in Real-Time
  useEffect(() => {
    const unsubItems = onSnapshot(doc(db, "cathlab", "items"), (doc) => {
      if (doc.exists()) setItems(doc.data().list);
      setLoading(false); // Data is here, we can start!
    });
    const unsubTx = onSnapshot(doc(db, "cathlab", "transactions"), (doc) => {
      if (doc.exists()) setTransactions(doc.data().list);
    });
    const unsubPos = onSnapshot(doc(db, "cathlab", "pos"), (doc) => {
      if (doc.exists()) setPos(doc.data().list);
    });

    return () => { unsubItems(); unsubTx(); unsubPos(); }; // Cleanup
  }, []);

  // 2. SAVE: Send data to Google whenever it changes
  // (But ONLY if we are finished loading, to prevent wiping data)
  
  useEffect(() => {
    if (!loading) setDoc(doc(db, "cathlab", "items"), { list: items });
  }, [items, loading]);

  useEffect(() => {
    if (!loading) setDoc(doc(db, "cathlab", "transactions"), { list: transactions });
  }, [transactions, loading]);

  useEffect(() => {
    if (!loading) setDoc(doc(db, "cathlab", "pos"), { list: pos });
  }, [pos, loading]);

  // --- Logic & Calculations ---

  // Calculate generic stock levels based on transactions
  const inventoryStats = useMemo(() => {
    const stats = {};
    
    items.forEach(item => {
      stats[item.gtin] = {
        qoh: 0,
        received: 0,
        used: 0,
        adjusted: 0,
        onOrder: 0,
        batches: [] // Track separate batches for FIFO logic
      };
    });

    // 1. Process Transactions
    const sortedTx = [...transactions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    sortedTx.forEach(tx => {
      if (!stats[tx.gtin]) return;
      const qty = parseInt(tx.quantity);
      
      if (tx.type === 'receive') {
        stats[tx.gtin].received += qty;
        stats[tx.gtin].qoh += qty;
        stats[tx.gtin].batches.push({ 
          expiry: tx.expiryDate, 
          qty: qty, 
          originalQty: qty 
        });
      } else if (tx.type === 'use') {
        stats[tx.gtin].used += Math.abs(qty);
        stats[tx.gtin].qoh -= Math.abs(qty);
      } else if (tx.type === 'adjust') {
        stats[tx.gtin].adjusted += qty;
        stats[tx.gtin].qoh += qty;
        // Adjustments are tricky for FIFO, simplistic approach: treat pos adjust as receive, neg as use
        if (qty > 0) {
           stats[tx.gtin].batches.push({ expiry: tx.expiryDate || 'N/A', qty: qty, originalQty: qty });
        }
      }
    });

    // 2. FIFO Logic for Expiry Dates
    // We deduct 'used' count from the oldest batches to see what's actually left
    items.forEach(item => {
      const data = stats[item.gtin];
      if (!data) return;

      // Sort batches by expiry date
      data.batches.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));

      let quantityToDeduct = data.used + (data.adjusted < 0 ? Math.abs(data.adjusted) : 0);
      
      // Remove used items from batches
      data.remainingBatches = data.batches.map(batch => {
        if (quantityToDeduct <= 0) return batch;
        
        if (batch.qty > quantityToDeduct) {
          const newQty = batch.qty - quantityToDeduct;
          quantityToDeduct = 0;
          return { ...batch, qty: newQty };
        } else {
          quantityToDeduct -= batch.qty;
          return { ...batch, qty: 0 };
        }
      }).filter(b => b.qty > 0);

      // Determine next expiry date
      if (data.remainingBatches.length > 0) {
        data.nextExpiry = data.remainingBatches[0].expiry;
      } else {
        data.nextExpiry = null;
      }
    });

    // 3. Process POs for "On Order"
    pos.forEach(po => {
      if (po.status === 'Open' || po.status === 'Partial') {
        po.items.forEach(poItem => {
          if (stats[poItem.gtin]) {
            stats[poItem.gtin].onOrder += poItem.qty;
          }
        });
      }
    });

    return stats;
  }, [items, transactions, pos]);


  // --- Views ---

  const DashboardView = () => {
    const [sortConfig, setSortConfig] = useState({ key: 'shortage', direction: 'asc' });

    const dashboardItems = items.filter(i => i.status === 'active').map(item => {
      const stat = inventoryStats[item.gtin] || { qoh: 0, onOrder: 0, nextExpiry: null, remainingBatches: [] };
      const shortage = item.par - (stat.qoh + stat.onOrder);
      const daysToExpiry = stat.nextExpiry ? getDaysDifference(stat.nextExpiry) : 9999;
      
      // Calculate Expiry Breakdown
      const expBreakdown = { expired: 0, critical: 0, warning: 0 };
      if (stat.remainingBatches) {
          stat.remainingBatches.forEach(b => {
              const days = getDaysDifference(b.expiry);
              if (days < 0) expBreakdown.expired += b.qty;
              else if (days < 30) expBreakdown.critical += b.qty;
              else if (days < 90) expBreakdown.warning += b.qty;
          });
      }

      let expiryStatus = 'good';
      if (stat.qoh > 0) {
          if (daysToExpiry < 0) expiryStatus = 'expired';
          else if (daysToExpiry < 30) expiryStatus = 'critical';
          else if (daysToExpiry < 90) expiryStatus = 'warning';
      }

      return {
        ...item,
        qoh: stat.qoh,
        onOrder: stat.onOrder,
        nextExpiry: stat.nextExpiry,
        shortage: shortage,
        expiryStatus,
        expBreakdown
      };
    }).sort((a, b) => {
      if (sortConfig.key === 'expiry') {
         // Sort by days to expiry (ascending)
         const dateA = a.nextExpiry ? new Date(a.nextExpiry) : new Date('2099-01-01');
         const dateB = b.nextExpiry ? new Date(b.nextExpiry) : new Date('2099-01-01');
         return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      // Numeric sorts
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return (
      <div className="space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Inventory Dashboard</h2>
            <p className="text-gray-500 text-sm">Real-time stock overview</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-white rounded border text-sm">
              <span className="w-3 h-3 rounded-full bg-red-500"></span> Expired
              <span className="w-3 h-3 rounded-full bg-orange-500"></span> &lt; 30 Days
              <span className="w-3 h-3 rounded-full bg-yellow-400"></span> &lt; 90 Days
            </div>
          </div>
        </header>

        <Card className="overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => setSortConfig({key: 'name', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>Item Name</th>
                <th className="p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => setSortConfig({key: 'vendor', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>Vendor</th>
                <th className="p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Ref / GTIN</th>
                <th className="p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center cursor-pointer" onClick={() => setSortConfig({key: 'par', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>PAR</th>
                <th className="p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center cursor-pointer" onClick={() => setSortConfig({key: 'qoh', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>QOH</th>
                <th className="p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">On Order</th>
                 <th className="p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center cursor-pointer" onClick={() => setSortConfig({key: 'expiry', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>Expiry Alerts</th>
                <th className="p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dashboardItems.map(item => (
                <tr key={item.gtin} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">{item.name}</td>
                  <td className="p-4 text-sm text-gray-600">{item.vendor}</td>
                  <td className="p-4 text-sm text-gray-500">
                    <div>{item.ref}</div>
                    <div className="text-xs text-gray-400 font-mono">{item.gtin}</div>
                  </td>
                  <td className="p-4 text-center text-sm">{item.par}</td>
                  <td className="p-4 text-center font-bold">{item.qoh}</td>
                  <td className="p-4 text-center text-sm text-gray-500">{item.onOrder > 0 ? item.onOrder : '-'}</td>
                  <td className="p-4 text-center text-sm">
                    {item.qoh > 0 ? (
                      <div className="flex flex-col gap-1 items-center">
                        {item.expBreakdown.expired > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 whitespace-nowrap">
                            {item.expBreakdown.expired} Expired
                          </span>
                        )}
                        {item.expBreakdown.critical > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800 whitespace-nowrap">
                            {item.expBreakdown.critical} &lt; 30d
                          </span>
                        )}
                        {item.expBreakdown.warning > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800 whitespace-nowrap">
                            {item.expBreakdown.warning} &lt; 90d
                          </span>
                        )}
                        {item.expBreakdown.expired === 0 && item.expBreakdown.critical === 0 && item.expBreakdown.warning === 0 && (
                           <span className="text-green-700 font-medium">
                             {formatDate(item.nextExpiry)}
                           </span>
                        )}
                      </div>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                   <td className="p-4 text-center">
                    {item.shortage > 0 ? (
                      <Badge color="red">Short: {item.shortage}</Badge>
                    ) : (
                      <Badge color="green">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {dashboardItems.length === 0 && (
                <tr>
                   <td colSpan="8" className="p-8 text-center text-gray-400">No active items found. Add items in Master DB.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  const ScannerView = () => {
    const [mode, setMode] = useState('receive'); // receive, use, adjust
    const [inputVal, setInputVal] = useState('');
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredSuggestions, setFilteredSuggestions] = useState([]);
    
    // Global Inputs for Use/Adjust
    const [globalCaseId, setGlobalCaseId] = useState('');
    const [globalReason, setGlobalReason] = useState('');

    // Mode Configuration
    const modes = {
      receive: { color: 'green', label: 'Stock In', icon: Truck },
      use: { color: 'red', label: 'Procedure Log', icon: Activity },
      adjust: { color: 'blue', label: 'Adjustment', icon: FileText }
    };
    const currentMode = modes[mode];

    // Search Filtering
    useEffect(() => {
        if (!searchTerm) {
            setFilteredSuggestions([]);
            return;
        }
        const lower = searchTerm.toLowerCase();
        setFilteredSuggestions(items.filter(i => 
            i.status === 'active' && 
            (i.name.toLowerCase().includes(lower) || i.ref.toLowerCase().includes(lower) || i.gtin.includes(lower))
        ).slice(0, 5));
    }, [searchTerm]);

    const handleAddItem = (item, scannedExpiry = null) => {
      // scannedExpiry is usually YYYY-MM-DD from parser
      const existingInCart = cart.findIndex(c => c.gtin === item.gtin && c.expiry === scannedExpiry);
      
      const newItem = {
        cartId: generateId(),
        gtin: item.gtin,
        name: item.name,
        ref: item.ref,
        qty: 1,
        // If scanned, use it. If receiving manual OR adjusting (positive default), start empty to force input. If use, N/A.
        expiry: scannedExpiry || ((mode === 'receive' || mode === 'adjust') ? '' : 'N/A'),
        // Store raw input for the YYYYMMDD field
        expiryInput: scannedExpiry ? scannedExpiry.replace(/-/g, '') : '',
      };

      if (existingInCart >= 0 && mode !== 'receive') {
          // consolidate if not receiving (receiving might have diff expiries)
          const newCart = [...cart];
          newCart[existingInCart].qty += 1;
          setCart(newCart);
      } else {
          setCart([...cart, newItem]);
      }
      setSearchTerm('');
      setInputVal('');
    };

    const parseBarcode = (raw) => {
       // Simple GS1 parser (Simulated)
       // Expects pattern like: (01)GTIN(17)YYMMDD(10)LOT
       // Or raw: 010012345678901217251231
       
       let gtin = null;
       let expiry = null;

       // Clean brackets
       const clean = raw.replace(/\(/g, '').replace(/\)/g, '');

       // Check for GTIN (AI 01)
       const ai01Index = clean.indexOf('01');
       if (ai01Index !== -1 && clean.length >= ai01Index + 16) {
           gtin = clean.substr(ai01Index + 2, 14);
       }

       // Check for Expiry (AI 17) - Format YYMMDD
       const ai17Index = clean.indexOf('17');
       if (ai17Index !== -1 && clean.length >= ai17Index + 8) {
           const yymmdd = clean.substr(ai17Index + 2, 6);
           // Convert YYMMDD to YYYY-MM-DD
           const year = '20' + yymmdd.substr(0, 2);
           const month = yymmdd.substr(2, 2);
           const day = yymmdd.substr(4, 2);
           expiry = `${year}-${month}-${day}`;
       }

       // Fallback: If input matches a known GTIN exactly
       if (!gtin) {
           const directMatch = items.find(i => i.gtin === raw || i.ref === raw);
           if (directMatch) gtin = directMatch.gtin;
       }

       return { gtin, expiry };
    };

    const handleScan = (e) => {
      e.preventDefault();
      const { gtin, expiry } = parseBarcode(inputVal);
      
      const item = items.find(i => i.gtin === gtin);
      if (item) {
        handleAddItem(item, expiry);
      } else {
        alert(`Unknown Item (GTIN: ${gtin || inputVal}). Please add to Master DB first.`);
      }
    };

    const handleFinalize = () => {
       if (cart.length === 0) return;

       // Global Validation
       if (mode === 'use' && !globalCaseId) {
           alert("Please enter a Case ID / Patient #.");
           return;
       }
       if (mode === 'adjust' && !globalReason) {
           alert("Please enter a Reason for adjustment.");
           return;
       }

       // Item Validation
       for (let item of cart) {
           const requiresExpiry = mode === 'receive' || (mode === 'adjust' && item.qty > 0);
           if (requiresExpiry && (!item.expiry || item.expiry.length !== 10)) {
               alert(`Valid expiry date (YYYYMMDD) required for ${item.name} (Positive Qty)`);
               return;
           }
       }

       // Create Transactions
       const newTx = cart.map(item => ({
           id: generateId(),
           timestamp: new Date().toISOString(),
           type: mode, // receive, use, adjust
           gtin: item.gtin,
           itemName: item.name, // Snapshot name
           quantity: mode === 'use' ? -item.qty : item.qty, // adjust just takes item.qty directly
           expiryDate: item.expiry,
           caseId: mode === 'use' ? globalCaseId : null,
           reason: mode === 'adjust' ? globalReason : null
       }));

       setTransactions([...transactions, ...newTx]);
       setCart([]);
       setGlobalCaseId('');
       setGlobalReason('');
       alert('Transaction finalized successfully!');
    };

    return (
      <div className="flex flex-col h-full gap-4">
        {/* Top Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Mode Selector */}
            <Card className="p-4 flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-500 uppercase">Operation Mode</label>
                <div className="flex rounded-md shadow-sm">
                    {Object.keys(modes).map((k) => {
                        const ModeIcon = modes[k].icon;
                        return (
                            <button
                                key={k}
                                onClick={() => { 
                                    setMode(k); 
                                    setCart([]); 
                                    setGlobalCaseId('');
                                    setGlobalReason('');
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium border first:rounded-l-md last:rounded-r-md 
                                    ${mode === k 
                                        ? `bg-${modes[k].color}-600 text-white border-${modes[k].color}-600` 
                                        : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                                <ModeIcon size={16} />
                                {modes[k].label}
                            </button>
                        );
                    })}
                </div>
            </Card>

            {/* Scanner Input */}
            <Card className="p-4 flex flex-col gap-2 col-span-2">
                <label className="text-sm font-semibold text-gray-500 uppercase">Input / Scan</label>
                <div className="flex gap-2 relative">
                    <form onSubmit={handleScan} className="flex-1 flex gap-2">
                        <input 
                            type="text"
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            placeholder="Click here & scan barcode or type GTIN..."
                            className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            autoFocus
                        />
                         <button type="submit" className="bg-gray-800 text-white px-4 rounded hover:bg-gray-700">
                             <Plus size={20} />
                         </button>
                    </form>
                </div>
                {/* Manual Search Fallback */}
                <div className="relative">
                     <div className="flex items-center border border-gray-300 rounded bg-gray-50 p-1">
                        <Search size={16} className="ml-2 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="Or search by name/ref..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent p-1 ml-2 focus:outline-none text-sm"
                        />
                     </div>
                     {filteredSuggestions.length > 0 && (
                         <div className="absolute z-10 w-full bg-white border border-gray-200 shadow-lg rounded mt-1 max-h-48 overflow-y-auto">
                             {filteredSuggestions.map(item => (
                                 <div 
                                    key={item.gtin} 
                                    className="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b"
                                    onClick={() => handleAddItem(item)}
                                >
                                     <div className="font-bold text-gray-800">{item.name}</div>
                                     <div className="text-xs text-gray-500">Ref: {item.ref} | GTIN: {item.gtin}</div>
                                 </div>
                             ))}
                         </div>
                     )}
                </div>
            </Card>
        </div>

        {/* Cart Area */}
        <div className="flex-1 bg-white border rounded-lg shadow-sm flex flex-col">
            <div className={`p-4 border-b flex justify-between items-center bg-${currentMode.color}-50`}>
                <h3 className={`font-bold text-${currentMode.color}-800 flex items-center gap-2`}>
                   <ShoppingCart size={20} /> 
                   Current {currentMode.label} List
                </h3>
                <span className="text-sm text-gray-500">{cart.length} items</span>
            </div>

            {/* GLOBAL INPUTS for Use/Adjust */}
            {/* Case ID input moved to footer */}
            {mode === 'adjust' && (
                <div className="p-4 bg-blue-50 border-b border-blue-100 animate-fade-in">
                    <label className="block text-sm font-bold text-blue-800 mb-1">
                        Adjustment Reason (Applies to all items)
                    </label>
                    <input 
                        type="text" 
                        value={globalReason}
                        onChange={e => setGlobalReason(e.target.value)}
                        className="w-full p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Enter Reason Code..."
                        autoFocus
                    />
                </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Scan size={48} className="mb-2 opacity-50" />
                        <p>Scan items or search to begin</p>
                    </div>
                ) : (
                    cart.map((item, idx) => (
                        <div key={item.cartId} className="flex flex-col md:flex-row gap-4 p-3 border rounded bg-gray-50 items-start md:items-center">
                            <div className="flex-1">
                                <div className="font-bold text-gray-800">{item.name}</div>
                                <div className="text-xs text-gray-500">{item.ref} ({item.gtin})</div>
                            </div>

                            {/* Dynamic Inputs based on Mode */}
                            <div className="flex flex-wrap gap-2 items-center">
                                {/* Quantity */}
                                <div className="flex items-center border bg-white rounded">
                                    <button onClick={() => {
                                        const newCart = [...cart];
                                        const current = parseInt(item.qty) || 0;
                                        // Logic change: For adjust, allow any number. For others, min 1.
                                        if (mode === 'adjust') {
                                             newCart[idx].qty = current - 1;
                                        } else {
                                             newCart[idx].qty = Math.max(1, current - 1);
                                        }
                                        setCart(newCart);
                                    }} className="px-2 py-1 hover:bg-gray-100"><Minus size={14}/></button>
                                    
                                    <input 
                                        type="number"
                                        // Remove strictly min="1" for adjust
                                        min={mode === 'adjust' ? undefined : "1"}
                                        value={item.qty}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const newCart = [...cart];
                                            // Allow '-' for negative input in adjust mode
                                            if (val === '-' && mode === 'adjust') {
                                                 newCart[idx].qty = val; // Store as string momentarily
                                            } else {
                                                 newCart[idx].qty = val === '' ? '' : parseInt(val);
                                            }
                                            setCart(newCart);
                                        }}
                                        onBlur={() => {
                                            // Logic change: validation on blur
                                            const val = parseInt(item.qty);
                                            const newCart = [...cart];
                                            
                                            if (isNaN(val)) {
                                                 // Reset if invalid
                                                 newCart[idx].qty = mode === 'adjust' ? 0 : 1; 
                                            } else if (mode !== 'adjust' && val < 1) {
                                                 newCart[idx].qty = 1;
                                            } else {
                                                 newCart[idx].qty = val; // Ensure number type
                                            }
                                            setCart(newCart);
                                        }}
                                        className="w-16 text-center text-sm font-mono border-x border-gray-200 py-1 focus:outline-none"
                                    />

                                    <button onClick={() => {
                                        const newCart = [...cart];
                                        const current = parseInt(item.qty) || 0;
                                        newCart[idx].qty = current + 1;
                                        setCart(newCart);
                                    }} className="px-2 py-1 hover:bg-gray-100"><Plus size={14}/></button>
                                </div>

                                {/* Expiry Input (Mandatory for Receive OR Positive Adjust) */}
                                {(mode === 'receive' || (mode === 'adjust' && item.qty > 0)) && (
                                    <input 
                                        type="text"
                                        placeholder="YYYYMMDD"
                                        maxLength={8}
                                        value={item.expiryInput || ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, ''); // Numbers only
                                            const newCart = [...cart];
                                            newCart[idx].expiryInput = val;
                                            
                                            // Try auto-convert if valid length
                                            if (val.length === 8) {
                                                const y = val.substr(0,4);
                                                const m = val.substr(4,2);
                                                const d = val.substr(6,2);
                                                newCart[idx].expiry = `${y}-${m}-${d}`;
                                            } else {
                                                newCart[idx].expiry = ''; // Invalid/Incomplete
                                            }
                                            
                                            setCart(newCart);
                                        }}
                                        className="border rounded p-1 text-sm w-28 text-center tracking-wider font-mono"
                                        required
                                    />
                                )}

                                <button 
                                    onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                                    className="text-red-500 p-1 hover:bg-red-50 rounded"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
                {mode === 'use' ? (
                     <div className="flex-1 w-full sm:w-auto">
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Case ID <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-red-300 rounded focus:ring-2 focus:ring-red-500 outline-none text-sm"
                            placeholder="Enter Case ID..."
                            value={globalCaseId}
                            onChange={(e) => setGlobalCaseId(e.target.value)}
                        />
                     </div>
                ) : <div className="flex-1"></div>}

                <button 
                    onClick={handleFinalize}
                    disabled={cart.length === 0 || (mode === 'use' && !globalCaseId)}
                    className={`px-6 py-2 rounded text-white font-bold shadow-sm flex items-center gap-2 h-10 mt-auto
                        ${(cart.length === 0 || (mode === 'use' && !globalCaseId)) ? 'bg-gray-300 cursor-not-allowed' : `bg-${currentMode.color}-600 hover:bg-${currentMode.color}-700`}`}
                >
                    <Save size={18} />
                    Finalize Transaction
                </button>
            </div>
        </div>
      </div>
    );
  };

  const MasterDBView = () => {
     const [editItem, setEditItem] = useState(null);
     const [showForm, setShowForm] = useState(false);
     const [dbLocked, setDbLocked] = useState(true);
     const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

     // Form State
     const [formData, setFormData] = useState({
         gtin: '', ref: '', name: '', vendor: '', par: 0, status: 'active'
     });

     const handleSave = () => {
        if (!formData.gtin || !formData.name) return alert("GTIN and Name required");

        if (editItem) {
            // Update
            setItems(items.map(i => i.gtin === editItem.gtin ? formData : i));
        } else {
            // Create
            if (items.find(i => i.gtin === formData.gtin)) return alert("GTIN must be unique");
            setItems([...items, formData]);
        }
        setShowForm(false);
        setEditItem(null);
        setFormData({ gtin: '', ref: '', name: '', vendor: '', par: 0, status: 'active' });
     };

     const handleEdit = (item) => {
         if (dbLocked) return;
         setEditItem(item);
         setFormData(item);
         setShowForm(true);
     };

     const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
     };

     const sortedItems = useMemo(() => {
         return [...items].sort((a, b) => {
             // Priority 1: Status (Active first, Archived last)
             if (a.status !== b.status) {
                 return a.status === 'active' ? -1 : 1;
             }
             
             // Priority 2: Selected Sort
             let valA = a[sortConfig.key];
             let valB = b[sortConfig.key];
             
             // Case insensitive for strings
             if (typeof valA === 'string') valA = valA.toLowerCase();
             if (typeof valB === 'string') valB = valB.toLowerCase();

             if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
             if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
             return 0;
         });
     }, [items, sortConfig]);

     const SortIcon = ({ column }) => {
         if (sortConfig.key !== column) return <ChevronDown size={14} className="text-gray-300 ml-1 inline" />;
         return sortConfig.direction === 'asc' 
            ? <ChevronUp size={14} className="text-blue-600 ml-1 inline" /> 
            : <ChevronDown size={14} className="text-blue-600 ml-1 inline" />;
     };

     return (
         <div className="space-y-4">
             <header className="flex justify-between items-center bg-white p-4 rounded shadow-sm">
                 <div>
                    <h2 className="text-xl font-bold">Master Item Database</h2>
                    <p className="text-sm text-gray-500">Manage catalog and PAR levels</p>
                 </div>
                 <div className="flex gap-2">
                     <button 
                        onClick={() => setDbLocked(!dbLocked)}
                        className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium border ${dbLocked ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600 border-red-200'}`}
                     >
                        {dbLocked ? <Lock size={16}/> : <Unlock size={16}/>}
                        {dbLocked ? 'DB Locked' : 'Unlocked'}
                     </button>
                     <button 
                        onClick={() => { setShowForm(true); setEditItem(null); setFormData({gtin:'', ref:'', name:'', vendor:'', par:0, status:'active'}); }}
                        disabled={dbLocked}
                        className={`flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium ${dbLocked ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                     >
                        <Plus size={16}/> Add New Item
                     </button>
                 </div>
             </header>

             {showForm && (
                 <Card className="p-6 bg-blue-50 border-blue-200">
                     <h3 className="font-bold text-lg mb-4">{editItem ? 'Edit Item' : 'New Item Definition'}</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Item Name</label>
                            <input className="w-full border rounded p-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">GTIN (Primary Key)</label>
                            <input className="w-full border rounded p-2" value={formData.gtin} onChange={e => setFormData({...formData, gtin: e.target.value})} disabled={!!editItem} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ref / Cat #</label>
                            <input className="w-full border rounded p-2" value={formData.ref} onChange={e => setFormData({...formData, ref: e.target.value})} />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Vendor</label>
                            <input className="w-full border rounded p-2" value={formData.vendor} onChange={e => setFormData({...formData, vendor: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700">PAR Level</label>
                                <input type="number" className="w-full border rounded p-2" value={formData.par} onChange={e => setFormData({...formData, par: parseInt(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                <select className="w-full border rounded p-2" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                    <option value="active">Active</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>
                     </div>
                     <div className="mt-4 flex justify-end gap-2">
                         <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded bg-white hover:bg-gray-50">Cancel</button>
                         <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Save Item</button>
                     </div>
                 </Card>
             )}

             <Card className="overflow-hidden">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-gray-50 text-gray-500">
                         <tr>
                             <th 
                                className="p-3 font-medium cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('name')}
                             >
                                 Item Details <SortIcon column="name" />
                             </th>
                             <th 
                                className="p-3 font-medium cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('vendor')}
                             >
                                 Vendor <SortIcon column="vendor" />
                             </th>
                             <th 
                                className="p-3 font-medium text-center cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('par')}
                             >
                                 PAR <SortIcon column="par" />
                             </th>
                             <th className="p-3 font-medium text-center">Status</th>
                             <th className="p-3 font-medium text-right">Actions</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y">
                         {sortedItems.map(item => (
                             <tr 
                                key={item.gtin} 
                                className={`group transition-colors ${item.status === 'archived' ? 'bg-gray-100 text-gray-500 opacity-75' : 'hover:bg-gray-50'}`}
                             >
                                 <td className="p-3">
                                     <div className={`font-medium ${item.status === 'archived' ? 'text-gray-600' : 'text-gray-900'}`}>{item.name}</div>
                                     <div className="text-xs text-gray-500">GTIN: {item.gtin} | Ref: {item.ref}</div>
                                 </td>
                                 <td className="p-3">{item.vendor}</td>
                                 <td className="p-3 text-center">{item.par}</td>
                                 <td className="p-3 text-center">
                                     <Badge color={item.status === 'active' ? 'green' : 'gray'}>{item.status}</Badge>
                                 </td>
                                 <td className="p-3 text-right">
                                     <button 
                                        onClick={() => handleEdit(item)} 
                                        disabled={dbLocked}
                                        className={`text-blue-600 hover:underline ${dbLocked ? 'opacity-30 cursor-not-allowed' : ''}`}
                                     >
                                         Edit
                                     </button>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </Card>
         </div>
     )
  };

  const PurchasingView = () => {
    // New State for Manual Creation
    const [poNumber, setPoNumber] = useState('');
    const [poSearch, setPoSearch] = useState('');
    const [poCart, setPoCart] = useState([]);
    const [poFilteredSuggestions, setPoFilteredSuggestions] = useState([]);
    const [selectedPO, setSelectedPO] = useState(null); // For Details View

    // Generate Suggestion List (Replenishment Logic)
    const suggestions = items.map(item => {
        const stat = inventoryStats[item.gtin];
        const needed = Math.max(0, item.par - (stat.qoh + stat.onOrder));
        return { ...item, ...stat, needed };
    }).filter(i => i.needed > 0 && i.status === 'active');

    // Search Logic for Adding Items Manually
    useEffect(() => {
        if (!poSearch) {
            setPoFilteredSuggestions([]);
            return;
        }
        const lower = poSearch.toLowerCase();
        setPoFilteredSuggestions(items.filter(i => 
            i.status === 'active' && 
            (i.name.toLowerCase().includes(lower) || i.ref.toLowerCase().includes(lower) || i.gtin.includes(lower))
        ).slice(0, 5));
    }, [poSearch]);

    const addToPOCart = (item, qty = 1) => {
        const existingIdx = poCart.findIndex(x => x.gtin === item.gtin);
        if (existingIdx >= 0) {
            const newCart = [...poCart];
            newCart[existingIdx].qty += qty;
            setPoCart(newCart);
        } else {
            setPoCart([...poCart, {
                gtin: item.gtin,
                name: item.name,
                ref: item.ref,
                qty: qty
            }]);
        }
        setPoSearch('');
    };

    const addAllSuggestions = () => {
        // Merge suggestions into cart
        const newCart = [...poCart];
        suggestions.forEach(s => {
            const existingIdx = newCart.findIndex(c => c.gtin === s.gtin);
            if (existingIdx >= 0) {
                // If already in cart, do we overwrite or add? Let's ensure at least 'needed' amount
                if (newCart[existingIdx].qty < s.needed) {
                    newCart[existingIdx].qty = s.needed;
                }
            } else {
                newCart.push({
                    gtin: s.gtin,
                    name: s.name,
                    ref: s.ref,
                    qty: s.needed
                });
            }
        });
        setPoCart(newCart);
    };

    const finalizePO = () => {
        if (!poNumber.trim()) return alert("PO Number is required.");
        if (poCart.length === 0) return alert("No items in the order.");
        
        // Check for duplicate PO ID
        if (pos.some(p => p.id === poNumber)) return alert("PO Number already exists!");

        const newPO = {
            id: poNumber,
            date: new Date().toISOString(),
            status: 'Open',
            items: poCart.map(i => ({
                gtin: i.gtin,
                name: i.name,
                ref: i.ref,
                qty: i.qty,
                cost: 0 // Placeholder
            }))
        };

        setPos([newPO, ...pos]);
        setPoCart([]);
        setPoNumber('');
        alert(`PO ${newPO.id} successfully created.`);
    };

    // Update PO Item Cost in Details View
    const updatePOCost = (poId, itemGtin, newCost) => {
        const updatedPos = pos.map(p => {
            if (p.id === poId) {
                const updatedItems = p.items.map(i => 
                    i.gtin === itemGtin ? { ...i, cost: newCost } : i
                );
                return { ...p, items: updatedItems };
            }
            return p;
        });
        setPos(updatedPos);
        // Also update local selectedPO to reflect change immediately
        if (selectedPO && selectedPO.id === poId) {
             const updatedItems = selectedPO.items.map(i => 
                    i.gtin === itemGtin ? { ...i, cost: newCost } : i
                );
             setSelectedPO({ ...selectedPO, items: updatedItems });
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
            {/* Modal for Details View */}
            {selectedPO && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-3xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
                        <button 
                            onClick={() => setSelectedPO(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X size={24} />
                        </button>
                        
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">PO Details: {selectedPO.id}</h3>
                                <div className="text-sm text-gray-500">Created: {new Date(selectedPO.date).toLocaleString()}</div>
                            </div>
                            <Badge color={selectedPO.status === 'Open' ? 'green' : 'gray'}>{selectedPO.status}</Badge>
                        </div>

                        <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto mb-6">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="p-3">Item Name</th>
                                        <th className="p-3">Ref</th>
                                        <th className="p-3">GTIN</th>
                                        <th className="p-3 text-center">Qty</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedPO.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3 font-medium">{item.name}</td>
                                            <td className="p-3 text-gray-600">{item.ref}</td>
                                            <td className="p-3 text-gray-500 font-mono text-xs">{item.gtin}</td>
                                            <td className="p-3 text-center font-bold">{item.qty}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-3">
                            {selectedPO.status === 'Open' && (
                                <button 
                                    onClick={() => {
                                        setPos(pos.map(p => p.id === selectedPO.id ? {...p, status: 'Closed'} : p));
                                        setSelectedPO({...selectedPO, status: 'Closed'});
                                    }}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium"
                                >
                                    Close PO (Archive)
                                </button>
                            )}
                            <button 
                                onClick={() => setSelectedPO(null)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </Card>
                </div>
            )}

            {/* LEFT COLUMN: Create PO */}
            <div className="space-y-4">
                <Card className="p-4 border-blue-200 bg-blue-50/50 flex flex-col h-[600px]">
                    <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                        <ShoppingCart className="text-blue-600" />
                        <h3 className="font-bold text-lg text-gray-800">Create Purchase Order</h3>
                    </div>

                    {/* Search & Add */}
                    <div className="relative mb-4 flex-shrink-0">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Add Items</label>
                        <div className="flex items-center border border-gray-300 rounded bg-white p-2 focus-within:ring-2 focus-within:ring-blue-500">
                            <Search size={18} className="text-gray-400 mr-2" />
                            <input 
                                type="text"
                                placeholder="Search by name, ref, or GTIN..."
                                value={poSearch}
                                onChange={e => setPoSearch(e.target.value)}
                                className="w-full bg-transparent outline-none text-sm"
                            />
                        </div>
                         {/* Dropdown Suggestions */}
                        {poFilteredSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full bg-white border border-gray-200 shadow-lg rounded mt-1 max-h-48 overflow-y-auto">
                                {poFilteredSuggestions.map(item => (
                                    <div 
                                    key={item.gtin} 
                                    className="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b flex justify-between items-center group"
                                    onClick={() => addToPOCart(item)}
                                    >
                                        <div>
                                            <div className="font-bold text-gray-800">{item.name}</div>
                                            <div className="text-xs text-gray-500">Ref: {item.ref}</div>
                                        </div>
                                        <Plus size={16} className="text-blue-500 opacity-0 group-hover:opacity-100" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Replenishment Shortcut */}
                    {suggestions.length > 0 && (
                        <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2 text-orange-800 text-sm">
                                <AlertTriangle size={16} />
                                <span><b>{suggestions.length} items</b> below PAR level.</span>
                            </div>
                            <button 
                                onClick={addAllSuggestions}
                                className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-1 rounded font-medium border border-orange-200"
                            >
                                Load Shortages
                            </button>
                        </div>
                    )}

                    {/* Draft List (Cart) */}
                    <div className="bg-white border rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
                        <div className="p-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase flex justify-between">
                            <span>Item Details</span>
                            <span>Qty</span>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {poCart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <FileBox size={32} className="mb-2 opacity-50" />
                                    <p className="text-sm">List is empty</p>
                                </div>
                            ) : (
                                poCart.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 border rounded hover:bg-gray-50">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="font-medium text-sm truncate">{item.name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{item.ref}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                min="1"
                                                className="w-16 p-1 border rounded text-center text-sm"
                                                value={item.qty}
                                                onChange={(e) => {
                                                    const newCart = [...poCart];
                                                    newCart[idx].qty = parseInt(e.target.value) || 0;
                                                    setPoCart(newCart);
                                                }}
                                            />
                                            <button 
                                                onClick={() => setPoCart(poCart.filter((_, i) => i !== idx))}
                                                className="text-gray-400 hover:text-red-500"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-3 border-t bg-gray-50 flex flex-col sm:flex-row gap-3 items-end sm:items-center justify-between">
                             <div className="flex-1 w-full sm:w-auto">
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">PO Number <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                    placeholder="Enter PO #"
                                    value={poNumber}
                                    onChange={(e) => setPoNumber(e.target.value)}
                                />
                             </div>
                             <button 
                                onClick={finalizePO}
                                disabled={poCart.length === 0 || !poNumber}
                                className={`px-6 py-2 rounded text-white font-bold shadow-sm h-10 mt-5
                                    ${poCart.length === 0 || !poNumber ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                Submit Order
                            </button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* RIGHT COLUMN: History */}
            <div className="space-y-4">
                 <h3 className="font-bold text-gray-800 flex items-center gap-2">
                     <History size={20} /> Order History
                 </h3>
                 <p className="text-sm text-gray-500">Double-click a PO to view details.</p>

                 <div className="space-y-3">
                     {pos.length === 0 && <div className="text-gray-400 italic p-4 border rounded bg-gray-50 text-center">No POs generated yet.</div>}
                     {pos.map(po => (
                         <div 
                            key={po.id} 
                            className="bg-white p-4 rounded border hover:shadow-md transition-shadow cursor-pointer group select-none"
                            onDoubleClick={() => setSelectedPO(po)}
                         >
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <div className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                         {po.id}
                                     </div>
                                     <div className="text-xs text-gray-500">{new Date(po.date).toLocaleDateString()} {new Date(po.date).toLocaleTimeString()}</div>
                                 </div>
                                 <Badge color={po.status === 'Open' ? 'green' : 'gray'}>{po.status}</Badge>
                             </div>
                             <div className="text-sm text-gray-600 flex justify-between items-center">
                                 <span>{po.items.length} Line Items | Total Qty: {po.items.reduce((a,b) => a + b.qty, 0)}</span>
                                 <span 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPO(po);
                                    }}
                                    className="text-xs text-blue-500 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1 z-10"
                                 >
                                     <Eye size={12} /> View Details
                                 </span>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
        </div>
    );
  };

  // --- Main Layout ---

  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all
        ${activeTab === id 
            ? 'bg-blue-100 text-blue-800 shadow-sm' 
            : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b shadow-sm z-10">
        <div className="px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg text-white">
                    <Activity size={20} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-800 leading-none">CathLab Inv</h1>
                    <p className="text-xs text-gray-400">v1.0.4</p>
                </div>
            </div>

            {/* Navigation Items */}
            <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto max-w-full">
              <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
              <NavItem id="actions" icon={Scan} label="Scanner" />
              <NavItem id="ledger" icon={History} label="Ledger" />
              <NavItem id="master" icon={Database} label="Master DB" />
              <NavItem id="purchasing" icon={ShoppingCart} label="Purchasing" />
            </nav>

            {/* System Status */}
            <div className="hidden md:block text-right">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">System Storage</div>
                <div className="flex items-center justify-end gap-1 text-xs text-green-600">
                    <CheckCircle size={10} /> Local
                </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'actions' && <ScannerView />}
            {activeTab === 'master' && <MasterDBView />}
            {activeTab === 'ledger' && <LedgerView transactions={transactions} setTransactions={setTransactions} />}
            {activeTab === 'purchasing' && <PurchasingView />}
        </div>
      </div>
    </div>
  );
}