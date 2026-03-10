import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Lock, 
  Unlock, 
  User, 
  Hash, 
  Plus, 
  Trash2, 
  FileUp, 
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Settings,
  Database,
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  History,
  X
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'locker-manager-sys';

export default function App() {
  const [user, setUser] = useState(null);
  const [lockers, setLockers] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('inventory'); // 'inventory' or 'maintenance'
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingLocker, setEditingLocker] = useState(null);
  const [activeLockerForLog, setActiveLockerForLog] = useState(null);
  const [viewingCombination, setViewingCombination] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) return;

    const lockersRef = collection(db, 'artifacts', appId, 'public', 'data', 'lockers');
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'maintenance');

    const unsubLockers = onSnapshot(query(lockersRef), (snapshot) => {
      setLockers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => notify("Error loading lockers", "error"));

    const unsubLogs = onSnapshot(query(logsRef), (snapshot) => {
      setMaintenanceLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => notify("Error loading logs", "error"));

    return () => { unsubLockers(); unsubLogs(); };
  }, [user]);

  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddOrUpdateLocker = async (e) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target);
    const data = {
      lockerNumber: formData.get('lockerNumber'),
      studentName: formData.get('studentName'),
      combination: formData.get('combination'),
      location: formData.get('location'),
      lastModified: new Date().toISOString(),
    };
    try {
      if (editingLocker) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', editingLocker.id), data);
        notify("Locker updated");
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'lockers'), data);
        notify("Locker added");
      }
      setIsModalOpen(false);
      setEditingLocker(null);
    } catch (e) { notify("Save failed", "error"); }
  };

  const handleDeleteLocker = async (id) => {
    if (!user || !window.confirm("Are you sure you want to delete this locker record?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', id));
      notify("Locker deleted");
    } catch (e) { notify("Delete failed", "error"); }
  };

  const handleAddMaintenanceLog = async (e) => {
    e.preventDefault();
    if (!user || !activeLockerForLog) return;
    const formData = new FormData(e.target);
    const logData = {
      lockerId: activeLockerForLog.id,
      lockerNumber: activeLockerForLog.lockerNumber,
      issue: formData.get('issue'),
      priority: formData.get('priority'),
      status: 'pending',
      createdAt: new Date().toISOString(),
      reportedBy: user.uid
    };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'maintenance'), logData);
      notify("Maintenance log added");
      setIsLogModalOpen(false);
    } catch (e) { notify("Log failed", "error"); }
  };

  const toggleLogStatus = async (log) => {
    if (!user) return;
    const newStatus = log.status === 'pending' ? 'resolved' : 'pending';
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maintenance', log.id), { status: newStatus });
      notify(`Issue marked as ${newStatus}`);
    } catch (e) { notify("Status update failed", "error"); }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = text.split('\n').slice(1);
      
      let count = 0;
      for (const row of rows) {
        const [lockerNumber, studentName, combination, location] = row.split(',').map(s => s?.trim());
        if (lockerNumber) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'lockers'), {
            lockerNumber, studentName, combination, location, lastModified: new Date().toISOString()
          });
          count++;
        }
      }
      notify(`Imported ${count} lockers`);
      setImportModalOpen(false);
    };
    reader.readAsText(file);
  };

  const filteredLockers = useMemo(() => {
    return lockers
      .filter(l => 
        l.lockerNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.location?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.lockerNumber.localeCompare(b.lockerNumber, undefined, {numeric: true}));
  }, [lockers, searchTerm]);

  const activeIssues = maintenanceLogs.filter(log => log.status === 'pending');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight hidden sm:block">LockerLink</h1>
              </div>
              <nav className="flex gap-1">
                <button 
                  onClick={() => setView('inventory')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${view === 'inventory' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Inventory
                </button>
                <button 
                  onClick={() => setView('maintenance')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${view === 'maintenance' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Maintenance
                  {activeIssues.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{activeIssues.length}</span>
                  )}
                </button>
              </nav>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => setImportModalOpen(true)} className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
                <FileUp className="w-4 h-4" /> Import
              </button>
              <button onClick={() => { setEditingLocker(null); setIsModalOpen(true); }} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-95 transition-all">
                <Plus className="w-4 h-4 inline mr-1" /> New Locker
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'inventory' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard icon={<Database className="w-5 h-5"/>} color="blue" label="Total" value={lockers.length} />
              <StatCard icon={<User className="w-5 h-5"/>} color="green" label="Assigned" value={lockers.filter(l => l.studentName).length} />
              <StatCard icon={<Unlock className="w-5 h-5"/>} color="orange" label="Available" value={lockers.filter(l => !l.studentName).length} />
              <StatCard icon={<Wrench className="w-5 h-5"/>} color="red" label="Maintenance" value={activeIssues.length} />
            </div>

            <div className="relative mb-8 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" placeholder="Search locker #, student, or wing..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-100 outline-none text-lg transition-all"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLockers.map((locker) => (
                <LockerCard 
                  key={locker.id} 
                  locker={locker} 
                  viewing={viewingCombination === locker.id}
                  setViewing={setViewingCombination}
                  onEdit={() => { setEditingLocker(locker); setIsModalOpen(true); }}
                  onDelete={() => handleDeleteLocker(locker.id)}
                  onLog={() => { setActiveLockerForLog(locker); setIsLogModalOpen(true); }}
                  issues={maintenanceLogs.filter(log => log.lockerId === locker.id && log.status === 'pending')}
                />
              ))}
            </div>
          </>
        ) : (
          <MaintenanceView logs={maintenanceLogs} toggleStatus={toggleLogStatus} />
        )}
      </main>

      {/* Modals */}
      {isModalOpen && <LockerModal locker={editingLocker} onSave={handleAddOrUpdateLocker} onClose={() => setIsModalOpen(false)} />}
      {isLogModalOpen && <MaintenanceModal locker={activeLockerForLog} onSave={handleAddMaintenanceLog} onClose={() => setIsLogModalOpen(false)} />}
      {importModalOpen && <ImportModal onImport={handleCSVImport} onClose={() => setImportModalOpen(false)} />}
      {notification && <Notification data={notification} />}
    </div>
  );
}

function StatCard({ icon, color, label, value }) {
  const colors = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", orange: "bg-orange-50 text-orange-600", red: "bg-red-50 text-red-600" };
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <div className={`${colors[color]} p-2 rounded-lg`}>{icon}</div>
        <span className="text-xs font-bold text-slate-400 uppercase">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function LockerCard({ locker, viewing, setViewing, onEdit, onDelete, onLog, issues }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 px-3 py-1 rounded-lg font-mono text-lg font-bold">#{locker.lockerNumber}</div>
          {issues.length > 0 && <div className="bg-red-100 text-red-600 p-1 rounded-full"><AlertTriangle className="w-4 h-4" /></div>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onLog} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500" title="Report Issue"><Wrench className="w-4 h-4"/></button>
          <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"><Settings className="w-4 h-4"/></button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-md text-red-400"><Trash2 className="w-4 h-4"/></button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          <span className={`font-medium ${locker.studentName ? 'text-slate-800' : 'text-slate-400 italic'}`}>
            {locker.studentName || 'Unassigned'}
          </span>
        </div>
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold font-mono tracking-widest bg-slate-50 px-2 py-1 rounded">
              {viewing ? locker.combination : '••-••-••'}
            </span>
          </div>
          <button 
            onMouseDown={() => setViewing(locker.id)} onMouseUp={() => setViewing(null)} onMouseLeave={() => setViewing(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"
          >
            {viewing ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} REVEAL
          </button>
        </div>
      </div>
    </div>
  );
}

function MaintenanceView({ logs, toggleStatus }) {
  const sorted = [...logs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <h2 className="font-bold flex items-center gap-2"><Wrench className="w-5 h-5 text-blue-600" /> Maintenance History</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {sorted.map(log => (
          <div key={log.id} className="p-6 flex items-start justify-between hover:bg-slate-50 transition-colors">
            <div className="flex gap-4">
              <div className={`mt-1 p-2 rounded-full ${log.status === 'resolved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {log.status === 'resolved' ? <CheckCircle className="w-5 h-5"/> : <Clock className="w-5 h-5"/>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-900">Locker #{log.lockerNumber}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${log.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {log.priority}
                  </span>
                </div>
                <p className="text-slate-600 text-sm mb-2">{log.issue}</p>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><History className="w-3 h-3"/> {new Date(log.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <button onClick={() => toggleStatus(log)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${log.status === 'resolved' ? 'bg-slate-100 text-slate-600' : 'bg-green-600 text-white'}`}>
              {log.status === 'resolved' ? 'Re-open' : 'Mark Fixed'}
            </button>
          </div>
        ))}
        {logs.length === 0 && <div className="p-20 text-center text-slate-400">No maintenance records.</div>}
      </div>
    </div>
  );
}

function LockerModal({ locker, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
        <h2 className="text-xl font-bold">{locker ? 'Edit Locker' : 'New Locker'}</h2>
        <form onSubmit={onSave} className="space-y-4">
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Locker Number</label><input name="lockerNumber" required defaultValue={locker?.lockerNumber} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Student Name</label><input name="studentName" defaultValue={locker?.studentName} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Combination</label><input name="combination" required defaultValue={locker?.combination} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Location</label><input name="location" defaultValue={locker?.location} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 font-semibold text-white bg-blue-600 rounded-xl">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MaintenanceModal({ locker, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
        <h2 className="text-xl font-bold">Report Issue: #{locker?.lockerNumber}</h2>
        <form onSubmit={onSave} className="space-y-4">
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Issue Description</label><textarea name="issue" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]" placeholder="What's wrong with the locker?" /></div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Priority Level</label>
            <select name="priority" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
              <option value="normal">Normal</option>
              <option value="high">High (Immediate attention)</option>
            </select>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 font-semibold text-white bg-blue-600 rounded-xl">Log Issue</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ onImport, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2">Import CSV</h2>
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50 relative mb-4">
          <input type="file" accept=".csv" onChange={onImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <FileUp className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Click to select CSV</p>
        </div>
        <button onClick={onClose} className="w-full px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-xl">Cancel</button>
      </div>
    </div>
  );
}

function Notification({ data }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl ${data.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>
      {data.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
      <span className="font-medium">{data.message}</span>
    </div>
  );
}