import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Lock, Unlock, User, UserPlus, UserMinus, Hash, Plus, Trash2, FileUp, 
  AlertCircle, CheckCircle2, Settings, Database, Wrench, Clock, 
  CheckCircle, AlertTriangle, History, X, MapPin 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
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

// --- YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBX37YTsUcqLPsgT-6nT1Lt7myTerDJUcc",
  authDomain: "wrms-lockers.firebaseapp.com",
  projectId: "wrms-lockers",
  storageBucket: "wrms-lockers.firebasestorage.app",
  messagingSenderId: "870499565234",
  appId: "1:870499565234:web:31b19a27693bfd6c1313ab",
  measurementId: "G-31J48M85NQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'wrms-locker-system';

// --- UI Sub-components ---

const StatCard = ({ label, value, icon, color }) => {
  const styles = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600"
  };
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
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
    <div className={`bg-white border rounded-2xl p-5 transition-all group relative ${isAvailable ? 'border-slate-200 shadow-sm' : 'border-blue-100 bg-blue-50/10 shadow-sm'}`}>
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
          <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500" title="Settings"><Settings className="w-4 h-4"/></button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Delete"><Trash2 className="w-4 h-4"/></button>
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
        <div className="mt-3 flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 p-2 rounded-xl text-[10px] font-bold">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate uppercase">{issues[0].issue}</span>
        </div>
      )}
    </div>
  );
};

// --- Main Application Component ---

export default function App() {
  const [user, setUser] = useState(null);
  const [lockers, setLockers] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('inventory');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  
  const [editingLocker, setEditingLocker] = useState(null);
  const [activeLockerForLog, setActiveLockerForLog] = useState(null);
  const [activeLockerForAssign, setActiveLockerForAssign] = useState(null);
  const [viewingCombination, setViewingCombination] = useState(null);
  const [notification, setNotification] = useState(null);

  // Authentication Setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
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
    
    // Correct Path for Firebase Rule 1
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
      studentName: formData.get('studentName') || "",
      combination: formData.get('combination'),
      location: formData.get('location'),
      lastModified: new Date().toISOString(),
    };
    try {
      if (editingLocker) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', editingLocker.id), data);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'lockers'), data);
      }
      setIsModalOpen(false);
      setEditingLocker(null);
      notify("Record Saved");
    } catch (e) { notify("Save Failed", "error"); }
  };

  const handleAssignStudent = async (e) => {
    e.preventDefault();
    if (!user || !activeLockerForAssign) return;
    const studentName = new FormData(e.target).get('studentName');
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', activeLockerForAssign.id), {
        studentName,
        lastModified: new Date().toISOString()
      });
      setIsAssignModalOpen(false);
      notify("Assigned successfully");
    } catch (e) { notify("Assignment Failed", "error"); }
  };

  const handleUnassign = async (locker) => {
    if (!user || !window.confirm(`Unassign student ${locker.studentName}?`)) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', locker.id), { 
        studentName: "",
        lastModified: new Date().toISOString()
      });
      notify("Unassigned");
    } catch (e) { notify("Update Failed", "error"); }
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
        const [num, name, combo, loc] = row.split(',').map(s => s?.trim());
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
      notify(`Imported ${count} items`);
      setImportModalOpen(false);
    };
    reader.readAsText(file);
  };

  const filteredLockers = useMemo(() => {
    return lockers
      .filter(l => 
        l.lockerNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.lockerNumber.localeCompare(b.lockerNumber, undefined, {numeric: true}));
  }, [lockers, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-md"><Lock className="w-5 h-5" /></div>
          <nav className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setView('inventory')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${view === 'inventory' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Inventory</button>
            <button onClick={() => setView('maintenance')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${view === 'maintenance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Issues</button>
          </nav>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportModalOpen(true)} className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"><FileUp className="w-5 h-5"/></button>
          <button onClick={() => { setEditingLocker(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md">+ New Locker</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8">
        {view === 'inventory' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total" value={lockers.length} icon={<Database className="w-4 h-4"/>} color="blue" />
              <StatCard label="Assigned" value={lockers.filter(l => l.studentName).length} icon={<User className="w-4 h-4"/>} color="indigo" />
              <StatCard label="Available" value={lockers.filter(l => !l.studentName).length} icon={<Unlock className="w-4 h-4"/>} color="green" />
              <StatCard label="Alerts" value={maintenanceLogs.filter(l => l.status === 'pending').length} icon={<AlertTriangle className="w-4 h-4"/>} color="red" />
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" placeholder="Search by number or student name..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLockers.map(locker => (
                <LockerItem 
                  key={locker.id} locker={locker} 
                  viewing={viewingCombination === locker.id} setViewing={setViewingCombination}
                  onEdit={() => { setEditingLocker(locker); setIsModalOpen(true); }}
                  onDelete={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', locker.id))}
                  onLog={() => { setActiveLockerForLog(locker); setIsLogModalOpen(true); }}
                  onAssign={() => { setActiveLockerForAssign(locker); setIsAssignModalOpen(true); }}
                  onUnassign={() => handleUnassign(locker)}
                  issues={maintenanceLogs.filter(log => log.lockerId === locker.id && log.status === 'pending')}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm animate-in fade-in duration-300">
             {maintenanceLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(log => (
               <div key={log.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                 <div>
                   <div className="font-bold text-slate-900 uppercase tracking-tight">Locker #{log.lockerNumber}</div>
                   <div className="text-sm text-slate-600 font-medium">{log.issue}</div>
                 </div>
                 <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maintenance', log.id), { status: log.status === 'pending' ? 'resolved' : 'pending' })} 
                         className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${log.status === 'resolved' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white shadow-md shadow-emerald-200'}`}>
                   {log.status === 'resolved' ? 'Fixed' : 'Mark Fixed'}
                 </button>
               </div>
             ))}
             {maintenanceLogs.length === 0 && <div className="p-20 text-center text-slate-400 italic font-medium">No maintenance logs found.</div>}
          </div>
        )}
      </main>

      {/* Modals */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddOrUpdateLocker} className="bg-white p-8 rounded-3xl w-full max-w-md space-y-4 shadow-2xl">
            <h2 className="text-2xl font-black">{editingLocker ? 'Edit Locker' : 'New Locker'}</h2>
            <div className="space-y-3">
              <div><label className="text-[10px] font-black uppercase text-slate-400">Locker #</label><input name="lockerNumber" required defaultValue={editingLocker?.lockerNumber} className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-blue-200 font-mono font-bold" /></div>
              <div><label className="text-[10px] font-black uppercase text-slate-400">Combination</label><input name="combination" required defaultValue={editingLocker?.combination} className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-blue-200 font-mono font-bold" /></div>
              <div><label className="text-[10px] font-black uppercase text-slate-400">Location</label><input name="location" defaultValue={editingLocker?.location} className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-blue-200 font-bold" /></div>
            </div>
            <div className="flex gap-2 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold uppercase text-xs tracking-widest">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest">Save Record</button>
            </div>
          </form>
        </div>
      )}

      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAssignStudent} className="bg-white p-8 rounded-3xl w-full max-w-md space-y-4 shadow-2xl">
            <h2 className="text-2xl font-black">Assign Locker #{activeLockerForAssign?.lockerNumber}</h2>
            <p className="text-sm text-slate-500">Type the student's name below.</p>
            <input name="studentName" required autoFocus placeholder="Student Name" className="w-full p-4 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-emerald-200 font-bold text-lg" />
            <div className="flex gap-2 pt-4">
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold uppercase text-xs tracking-widest">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest">Assign</button>
            </div>
          </form>
        </div>
      )}

      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const issue = new FormData(e.target).get('issue');
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'maintenance'), {
              lockerId: activeLockerForLog.id,
              lockerNumber: activeLockerForLog.lockerNumber,
              issue,
              status: 'pending',
              createdAt: new Date().toISOString()
            });
            setIsLogModalOpen(false);
            notify("Issue Reported");
          }} className="bg-white p-8 rounded-3xl w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">Report Issue</h2>
            <p className="text-sm text-slate-500">Locker #{activeLockerForLog?.lockerNumber}</p>
            <textarea name="issue" required className="w-full p-3 bg-slate-50 rounded-xl outline-none min-h-[100px]" placeholder="What's wrong with this locker?" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsLogModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold">Log Issue</button>
            </div>
          </form>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-3xl w-full max-w-md text-center shadow-2xl">
            <h2 className="text-2xl font-black mb-2">Import Data</h2>
            <p className="text-slate-500 text-sm mb-6">Upload a CSV file with headers: lockerNumber, studentName, combination, location.</p>
            <div className="relative border-4 border-dashed border-slate-100 p-12 rounded-3xl hover:bg-blue-50 transition-all cursor-pointer">
              <input type="file" accept=".csv" onChange={handleCSVImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <FileUp className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Select CSV File</p>
            </div>
            <button onClick={() => setImportModalOpen(false)} className="mt-6 text-slate-400 font-bold uppercase text-xs tracking-widest">Cancel</button>
          </div>
        </div>
      )}

      {notification && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-4`}>
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          <span className="font-bold uppercase text-xs tracking-widest">{notification.message}</span>
        </div>
      )}
    </div>
  );
}