import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Lock, Unlock, User, UserPlus, UserMinus, Hash, Plus, Trash2, FileUp, 
  AlertCircle, CheckCircle2, Eye, EyeOff, Settings, Database, Wrench, Clock, 
  CheckCircle, AlertTriangle, History, X, MapPin 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query 
} from 'firebase/firestore';

// --- Firebase Initialization ---
// The environment provides these configuration variables globally.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'locker-manager-sys';

// --- Sub-components for UI ---

const StatCard = ({ label, value, icon, color }) => {
  const styles = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600"
  };
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className={`${styles[color]} p-2 rounded-lg`}>{icon}</div>
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
};

const LockerItem = ({ locker, viewing, setViewing, onEdit, onDelete, onLog, onAssign, onUnassign, issues }) => {
  const isAvailable = !locker.studentName || locker.studentName.trim() === "";

  return (
    <div className={`bg-white border rounded-2xl p-5 transition-all group relative ${isAvailable ? 'border-slate-200' : 'border-blue-100 bg-blue-50/10 shadow-sm'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black font-mono tracking-tighter text-slate-900">#{locker.lockerNumber}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter ${isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              {isAvailable ? 'Available' : 'In Use'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400 mt-0.5">
            <MapPin className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase truncate max-w-[100px]">{locker.location || "N/A"}</span>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onLog} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500" title="Maintenance"><Wrench className="w-4 h-4"/></button>
          <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><Settings className="w-4 h-4"/></button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Delete"><Trash2 className="w-4 h-4"/></button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 truncate">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isAvailable ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white'}`}>
              <User className="w-4 h-4" />
            </div>
            <span className={`text-sm font-bold truncate ${isAvailable ? 'text-slate-400 italic' : 'text-slate-900'}`}>
              {isAvailable ? 'Vacant' : locker.studentName}
            </span>
          </div>
          {isAvailable ? (
            <button onClick={onAssign} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors" title="Assign">
              <UserPlus className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={onUnassign} className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg transition-colors" title="Unassign">
              <UserMinus className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between border border-slate-100">
          <div className="flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-sm font-black font-mono tracking-widest text-slate-700">
              {viewing ? locker.combination : '••-••-••'}
            </span>
          </div>
          <button 
            onMouseDown={() => setViewing(locker.id)} onMouseUp={() => setViewing(null)} onMouseLeave={() => setViewing(null)}
            className="text-[10px] font-black text-blue-600 tracking-widest uppercase hover:text-blue-700 outline-none"
          >
            {viewing ? "Hide" : "Reveal"}
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="mt-3 flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 p-2 rounded-xl text-[10px] font-bold uppercase truncate">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{issues[0].issue}</span>
        </div>
      )}
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState(null);
  const [lockers, setLockers] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('inventory'); // 'inventory' or 'maintenance'
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  
  const [editingLocker, setEditingLocker] = useState(null);
  const [activeLockerForLog, setActiveLockerForLog] = useState(null);
  const [activeLockerForAssign, setActiveLockerForAssign] = useState(null);
  const [viewingCombination, setViewingCombination] = useState(null);
  const [notification, setNotification] = useState(null);

  // Auth Initialization (Rule 3)
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

  // Data Fetching (Rule 1 & 2)
  useEffect(() => {
    if (!user) return;

    // Strict Paths (Rule 1)
    const lockersRef = collection(db, 'artifacts', appId, 'public', 'data', 'lockers');
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'maintenance');

    // Simple Queries (Rule 2)
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
      studentName: formData.get('studentName') || "",
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

  const handleAssignStudent = async (e) => {
    e.preventDefault();
    if (!user || !activeLockerForAssign) return;
    const formData = new FormData(e.target);
    const studentName = formData.get('studentName');
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', activeLockerForAssign.id), {
        studentName: studentName,
        lastModified: new Date().toISOString()
      });
      notify(`Assigned to ${studentName}`);
      setIsAssignModalOpen(false);
    } catch (e) { notify("Assignment failed", "error"); }
  };

  const handleUnassign = async (locker) => {
    if (!user || !window.confirm(`Unassign ${locker.studentName}?`)) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', locker.id), {
        studentName: "",
        lastModified: new Date().toISOString()
      });
      notify("Locker unassigned");
    } catch (e) { notify("Unassign failed", "error"); }
  };

  const handleDeleteLocker = async (id) => {
    if (!user || !window.confirm("Delete record permanently?")) return;
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
      createdAt: new Date().toISOString()
    };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'maintenance'), logData);
      notify("Issue reported");
      setIsLogModalOpen(false);
    } catch (e) { notify("Log failed", "error"); }
  };

  const toggleLogStatus = async (log) => {
    if (!user) return;
    const newStatus = log.status === 'pending' ? 'resolved' : 'pending';
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maintenance', log.id), { status: newStatus });
      notify(`Status: ${newStatus}`);
    } catch (e) { notify("Update failed", "error"); }
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
        const parts = row.split(',');
        if (parts.length < 3) continue;
        const [num, name, combo, loc] = parts.map(s => s?.trim());
        if (num) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'lockers'), {
            lockerNumber: num, 
            studentName: name || "", 
            combination: combo || "00-00-00", 
            location: loc || "", 
            lastModified: new Date().toISOString()
          });
          count++;
        }
      }
      notify(`Imported ${count} records`);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Lock className="w-5 h-5" /></div>
              <h1 className="text-lg font-bold tracking-tight hidden md:block">LockerLink</h1>
            </div>
            <nav className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setView('inventory')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${view === 'inventory' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Inventory</button>
              <button onClick={() => setView('maintenance')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${view === 'maintenance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Issues {activeIssues.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{activeIssues.length}</span>}
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => setImportModalOpen(true)} className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 border border-slate-200">
              <FileUp className="w-4 h-4" /> Import
            </button>
            <button onClick={() => { setEditingLocker(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all">
              <Plus className="w-4 h-4" /> New Locker
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'inventory' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total" value={lockers.length} icon={<Database className="w-4 h-4"/>} color="blue" />
              <StatCard label="Assigned" value={lockers.filter(l => l.studentName).length} icon={<User className="w-4 h-4"/>} color="indigo" />
              <StatCard label="Available" value={lockers.filter(l => !l.studentName).length} icon={<Unlock className="w-4 h-4"/>} color="green" />
              <StatCard label="Issues" value={activeIssues.length} icon={<AlertTriangle className="w-4 h-4"/>} color="red" />
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" placeholder="Search by number, student, or wing..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-50/50 outline-none text-lg transition-all"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLockers.map((locker) => (
                <LockerItem 
                  key={locker.id} 
                  locker={locker} 
                  viewing={viewingCombination === locker.id}
                  setViewing={setViewingCombination}
                  onEdit={() => { setEditingLocker(locker); setIsModalOpen(true); }}
                  onDelete={() => handleDeleteLocker(locker.id)}
                  onLog={() => { setActiveLockerForLog(locker); setIsLogModalOpen(true); }}
                  onAssign={() => { setActiveLockerForAssign(locker); setIsAssignModalOpen(true); }}
                  onUnassign={() => handleUnassign(locker)}
                  issues={maintenanceLogs.filter(log => log.lockerId === locker.id && log.status === 'pending')}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-3"><Wrench className="w-6 h-6 text-blue-600" /> Maintenance Center</h2>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{maintenanceLogs.length} Total Logs</span>
            </div>
            <div className="divide-y divide-slate-100">
              {maintenanceLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(log => (
                <div key={log.id} className="p-6 md:px-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex gap-5">
                    <div className={`mt-1 w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${log.status === 'resolved' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {log.status === 'resolved' ? <CheckCircle className="w-6 h-6"/> : <Clock className="w-6 h-6"/>}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg font-black text-slate-900">Locker #{log.lockerNumber}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${log.priority === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>
                          {log.priority}
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium mb-1">{log.issue}</p>
                      <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><History className="w-3 h-3"/> {new Date(log.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => toggleLogStatus(log)} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${log.status === 'resolved' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-emerald-600 text-white shadow-md shadow-emerald-100 hover:bg-emerald-700'}`}>
                    {log.status === 'resolved' ? 'Re-open' : 'Resolve'}
                  </button>
                </div>
              ))}
              {maintenanceLogs.length === 0 && <div className="py-24 text-center text-slate-400 font-bold uppercase tracking-widest italic">No Maintenance Logs found.</div>}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black mb-6">{editingLocker ? 'Update Locker' : 'New Locker Entry'}</h2>
            <form onSubmit={handleAddOrUpdateLocker} className="space-y-5">
              <div><label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Locker Number</label><input name="lockerNumber" required defaultValue={editingLocker?.lockerNumber} className="w-full px-5 py-3 bg-slate-100 border-none rounded-2xl font-mono font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all" /></div>
              <div><label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Current Student (Optional)</label><input name="studentName" defaultValue={editingLocker?.studentName} className="w-full px-5 py-3 bg-slate-100 border-none rounded-2xl font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all" /></div>
              <div><label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Combination Code</label><input name="combination" required defaultValue={editingLocker?.combination} className="w-full px-5 py-3 bg-slate-100 border-none rounded-2xl font-mono font-bold tracking-widest focus:ring-4 focus:ring-blue-100 outline-none transition-all" /></div>
              <div><label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Location / Hallway</label><input name="location" defaultValue={editingLocker?.location} className="w-full px-5 py-3 bg-slate-100 border-none rounded-2xl font-bold focus:ring-4 focus:ring-blue-100 transition-all outline-none" placeholder="e.g. North Wing" /></div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-4 font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-4 font-black uppercase tracking-widest text-white bg-blue-600 rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLogModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2"><Wrench className="w-6 h-6 text-rose-500" /> Report Issue</h2>
            <form onSubmit={handleAddMaintenanceLog} className="space-y-5">
              <div><label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block italic">Locker #{activeLockerForLog?.lockerNumber}</label><textarea name="issue" required className="w-full px-5 py-4 bg-slate-100 border-none rounded-2xl font-bold focus:ring-4 focus:ring-rose-100 outline-none transition-all min-h-[120px]" placeholder="Describe the mechanical issue..." /></div>
              <div>
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Priority</label>
                <select name="priority" className="w-full px-5 py-3 bg-slate-100 border-none rounded-xl font-bold focus:ring-4 focus:ring-rose-100 outline-none">
                  <option value="normal">Normal</option>
                  <option value="high">Urgent/High</option>
                </select>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsLogModalOpen(false)} className="flex-1 py-4 font-black uppercase tracking-widest text-slate-400">Cancel</button>
                <button type="submit" className="flex-1 py-4 font-black uppercase tracking-widest text-white bg-rose-600 rounded-2xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all">Report Issue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
              <UserPlus className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black mb-2">Assign Locker #{activeLockerForAssign?.lockerNumber}</h2>
            <p className="text-slate-500 text-sm mb-6 font-medium">Link a student to this locker.</p>
            <form onSubmit={handleAssignStudent} className="space-y-6">
              <input name="studentName" required autoFocus className="w-full px-5 py-4 bg-slate-100 border-none rounded-2xl font-bold text-lg focus:ring-4 focus:ring-emerald-100 outline-none transition-all" placeholder="Type student name..." />
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="flex-1 py-4 font-black uppercase text-slate-400 tracking-widest">Cancel</button>
                <button type="submit" className="flex-1 py-4 font-black uppercase text-white bg-emerald-600 rounded-2xl shadow-lg hover:bg-emerald-700 transition-all">Assign Now</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black mb-2">Import from Sheet</h2>
            <p className="text-slate-500 text-sm mb-6">Upload your exported Google Sheet (.csv).</p>
            <div className="border-4 border-dashed border-slate-100 rounded-3xl p-12 text-center bg-slate-50 relative mb-6 hover:bg-blue-50 transition-all">
              <input type="file" accept=".csv" onChange={handleCSVImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <FileUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-black uppercase text-xs tracking-widest">Select CSV File</p>
            </div>
            <button onClick={() => setImportModalOpen(false)} className="w-full py-4 font-black uppercase tracking-widest text-slate-400">Close</button>
          </div>
        </div>
      )}
      
      {notification && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 px-8 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-8 duration-300 ${notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          <span className="font-black uppercase text-xs tracking-widest">{notification.message}</span>
        </div>
      )}
    </div>
  );
}