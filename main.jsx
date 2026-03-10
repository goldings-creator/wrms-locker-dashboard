import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Lock, Unlock, User, UserPlus, UserMinus, Hash, Plus, Trash2, FileUp, 
  AlertCircle, CheckCircle2, Settings, Database, Wrench, Clock, 
  CheckCircle, AlertTriangle, History, X, MapPin, Layers, ChevronDown
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
  setDoc,
  deleteDoc, 
  query 
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBX37YTsUcqLPsgT-6nT1Lt7myTerDJUcc",
  authDomain: "wrms-lockers.firebaseapp.com",
  projectId: "wrms-lockers",
  storageBucket: "wrms-lockers.firebasestorage.app",
  messagingSenderId: "870499565234",
  appId: "1:870499565234:web:31b19a27693bfd6c1313ab"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'wrms-locker-system';

// --- Shared UI Components ---

const StatCard = ({ label, value, color }) => {
  const colors = {
    blue: "text-blue-600 bg-blue-50",
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    rose: "text-rose-600 bg-rose-50"
  };
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900">{value}</span>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState(null);
  const [lockers, setLockers] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [activeSet, setActiveSet] = useState(1); 
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

  // Data Fetching (Rule 1 & 3)
  useEffect(() => {
    if (!user) return;

    // Fixed path for settings document (Rule 1: even number of segments)
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
    const lockersRef = collection(db, 'artifacts', appId, 'public', 'data', 'lockers');
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'maintenance');

    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) setActiveSet(docSnap.data().activeSet || 1);
    }, (err) => console.error("Settings error:", err));

    const unsubLockers = onSnapshot(query(lockersRef), (snapshot) => {
      setLockers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => notify("Database Connection Error", "error"));

    const unsubLogs = onSnapshot(query(logsRef), (snapshot) => {
      setMaintenanceLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => notify("Log Sync Error", "error"));

    return () => { unsubSettings(); unsubLockers(); unsubLogs(); };
  }, [user]);

  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const updateGlobalComboSet = async (newSet) => {
    if (!user) return;
    try {
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
      await setDoc(settingsRef, { 
        activeSet: newSet,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      notify(`Switching to Combination Set #${newSet}`);
    } catch (e) { notify("Permission Denied", "error"); }
  };

  const handleAddOrUpdateLocker = async (e) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target);
    const data = {
      lockerNumber: formData.get('lockerNumber'),
      studentName: formData.get('studentName') || "",
      location: formData.get('location'),
      combination1: formData.get('combination1') || "00-00-00",
      combination2: formData.get('combination2') || "00-00-00",
      combination3: formData.get('combination3') || "00-00-00",
      combination4: formData.get('combination4') || "00-00-00",
      combination5: formData.get('combination5') || "00-00-00",
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

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = text.split('\n').filter(r => r.trim() !== '').slice(1);
      let count = 0;
      for (const row of rows) {
        const parts = row.split(',').map(s => s?.trim());
        if (parts[0]) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'lockers'), {
            lockerNumber: parts[0], 
            studentName: parts[1] || "", 
            combination1: parts[2] || "00-00-00", 
            combination2: parts[3] || "00-00-00", 
            combination3: parts[4] || "00-00-00", 
            combination4: parts[5] || "00-00-00", 
            combination5: parts[6] || "00-00-00", 
            location: parts[7] || "", 
            lastModified: new Date().toISOString()
          });
          count++;
        }
      }
      notify(`Successfully imported ${count} lockers`);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-md"><Lock className="w-5 h-5" /></div>
              <h1 className="text-lg font-black tracking-tighter hidden md:block">WRMS Lockers</h1>
            </div>
            <nav className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setView('inventory')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${view === 'inventory' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Inventory</button>
              <button onClick={() => setView('maintenance')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${view === 'maintenance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Issues</button>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 bg-slate-50 px-4 py-1.5 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-black uppercase text-slate-400">Combo Set:</span>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(num => (
                  <button 
                    key={num} 
                    onClick={() => updateGlobalComboSet(num)}
                    className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${activeSet === num ? 'bg-blue-600 text-white shadow-md scale-110' : 'bg-white text-slate-400 hover:bg-slate-200'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setImportModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200"><FileUp className="w-5 h-5"/></button>
            <button onClick={() => { setEditingLocker(null); setIsModalOpen(true); }} className="px-5 py-2.5 text-sm font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md transition-all">+ NEW</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'inventory' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Lockers" value={lockers.length} color="blue" />
              <StatCard label="Assigned" value={lockers.filter(l => l.studentName).length} color="indigo" />
              <StatCard label="Available" value={lockers.filter(l => !l.studentName).length} color="emerald" />
              <StatCard label="Active Codes" value={`Set ${activeSet}`} color="rose" />
            </div>

            <div className="relative mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" />
              <input 
                type="text" placeholder="Search by Number, Student, or Location..."
                className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-3xl shadow-sm outline-none text-xl font-medium focus:ring-4 focus:ring-blue-50 transition-all"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredLockers.map((locker) => (
                <LockerItem 
                  key={locker.id} 
                  locker={locker} 
                  activeSet={activeSet}
                  viewing={viewingCombination === locker.id}
                  setViewing={setViewingCombination}
                  onEdit={() => { setEditingLocker(locker); setIsModalOpen(true); }}
                  onDelete={() => { if(window.confirm('Delete locker?')) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', locker.id))}}
                  onLog={() => { setActiveLockerForLog(locker); setIsLogModalOpen(true); }}
                  onAssign={() => { setActiveLockerForAssign(locker); setIsAssignModalOpen(true); }}
                  onUnassign={() => { if(window.confirm('Clear student assignment?')) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', locker.id), { studentName: "" })}}
                  issues={maintenanceLogs.filter(log => log.lockerId === locker.id && log.status === 'pending')}
                />
              ))}
            </div>
            {filteredLockers.length === 0 && <div className="p-20 text-center text-slate-300 font-bold italic">No lockers found matching your search.</div>}
          </>
        ) : (
          <MaintenanceView logs={maintenanceLogs} onUpdate={(id, data) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maintenance', id), data)} />
        )}
      </main>

      {/* Modals */}
      {isModalOpen && <LockerModal locker={editingLocker} onSave={handleAddOrUpdateLocker} onClose={() => setIsModalOpen(false)} />}
      {isAssignModalOpen && <AssignModal locker={activeLockerForAssign} onClose={() => setIsAssignModalOpen(false)} db={db} appId={appId} />}
      {isLogModalOpen && <IssueModal locker={activeLockerForLog} onClose={() => setIsLogModalOpen(false)} db={db} appId={appId} />}
      {importModalOpen && <ImportModal onImport={handleCSVImport} onClose={() => setImportModalOpen(false)} />}
      
      {notification && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl shadow-2xl z-[200] font-bold text-white transition-all animate-bounce ${notification.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

// --- Internal Components ---

function LockerItem({ locker, activeSet, viewing, setViewing, onEdit, onDelete, onLog, onAssign, onUnassign, issues }) {
  const isAvailable = !locker.studentName || locker.studentName.trim() === "";
  const currentCombo = locker[`combination${activeSet}`] || "00-00-00";

  return (
    <div className={`bg-white border rounded-3xl p-6 transition-all group relative ${isAvailable ? 'border-slate-200' : 'border-blue-100 bg-blue-50/20'}`}>
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black font-mono tracking-tighter">#{locker.lockerNumber}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'}`}>
              {isAvailable ? 'Vacant' : 'Assigned'}
            </span>
          </div>
          <div className="text-[10px] font-bold uppercase text-slate-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3"/> {locker.location || "Hallway"}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onLog} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600"><Wrench className="w-4 h-4"/></button>
          <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600"><Settings className="w-4 h-4"/></button>
          <button onClick={onDelete} className="p-2 hover:bg-rose-50 rounded-xl text-rose-300 hover:text-rose-600"><Trash2 className="w-4 h-4"/></button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 truncate">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isAvailable ? 'bg-slate-50 text-slate-300' : 'bg-blue-100 text-blue-600'}`}>
              <User className="w-5 h-5"/>
            </div>
            <span className={`text-sm font-bold truncate ${isAvailable ? 'text-slate-300 italic' : 'text-slate-900'}`}>
              {isAvailable ? 'Unassigned' : locker.studentName}
            </span>
          </div>
          {isAvailable ? (
            <button onClick={onAssign} className="bg-emerald-50 text-emerald-600 p-2 rounded-xl hover:bg-emerald-100 transition-colors"><UserPlus className="w-5 h-5"/></button>
          ) : (
            <button onClick={onUnassign} className="text-slate-300 hover:text-rose-500 p-2 transition-colors"><UserMinus className="w-5 h-5"/></button>
          )}
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex justify-between items-center group/combo">
          <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-lg bg-slate-900 text-[10px] flex items-center justify-center text-white font-black`}>{activeSet}</div>
            <span className="text-md font-black font-mono tracking-[0.2em] text-slate-800">
              {viewing ? currentCombo : '••-••-••'}
            </span>
          </div>
          <button 
            onMouseDown={() => setViewing(locker.id)} 
            onMouseUp={() => setViewing(null)} 
            onMouseLeave={() => setViewing(null)}
            className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-100 active:scale-95 transition-all"
          >
            {viewing ? "Hide" : "Hold to Reveal"}
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="absolute -top-2 -right-2 bg-rose-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-pulse border-2 border-white">
          <AlertTriangle className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}

function MaintenanceView({ logs, onUpdate }) {
  const pending = logs.filter(l => l.status === 'pending');
  return (
    <div className="space-y-6">
      <div className="bg-rose-50 border border-rose-100 p-8 rounded-3xl text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-2xl font-black text-rose-900">{pending.length} Open Issues</h2>
        <p className="text-rose-600 font-medium">Locker repairs and maintenance requests.</p>
      </div>
      <div className="grid gap-4">
        {logs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(log => (
          <div key={log.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-4">
               <div className="bg-slate-100 w-12 h-12 rounded-xl flex items-center justify-center text-slate-900 font-black">#{log.lockerNumber}</div>
               <div>
                  <p className="font-bold text-slate-900">{log.issue}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{new Date(log.createdAt).toLocaleDateString()}</p>
               </div>
            </div>
            <button 
              onClick={() => onUpdate(log.id, { status: log.status === 'pending' ? 'resolved' : 'pending' })}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${log.status === 'resolved' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'}`}
            >
              {log.status === 'resolved' ? 'Fixed' : 'Mark Fixed'}
            </button>
          </div>
        ))}
        {logs.length === 0 && <div className="p-20 text-center text-slate-300 font-bold italic">No maintenance issues reported.</div>}
      </div>
    </div>
  );
}

function LockerModal({ locker, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-xl p-10 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black tracking-tighter">Locker Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6"/></button>
        </div>
        <form onSubmit={onSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Locker Number</label>
              <input name="lockerNumber" required defaultValue={locker?.lockerNumber} placeholder="e.g. 101" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Hallway/Location</label>
              <input name="location" defaultValue={locker?.location} placeholder="e.g. North Hall" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
            </div>
          </div>
          
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Combination List (Sets 1-5)</label>
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5].map(num => (
                <div key={num}>
                  <div className="text-[8px] font-black text-slate-300 mb-1 ml-1 text-center">SET {num}</div>
                  <input name={`combination${num}`} required defaultValue={locker?.[`combination${num}`] || "00-00-00"} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-center font-mono font-bold text-xs" />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-3">
             <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-xs">Discard</button>
             <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Save Record</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignModal({ locker, onClose, db, appId }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-md p-10 shadow-2xl text-center">
        <div className="bg-blue-50 w-20 h-20 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-6 shadow-inner"><UserPlus className="w-10 h-10"/></div>
        <h2 className="text-3xl font-black mb-2 tracking-tighter">Assign Locker #{locker?.lockerNumber}</h2>
        <p className="text-slate-500 font-medium mb-8">Type the student's name to assign this locker.</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const name = new FormData(e.target).get('studentName');
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lockers', locker.id), { 
            studentName: name,
            lastModified: new Date().toISOString()
          });
          onClose();
        }}>
          <input name="studentName" required autoFocus placeholder="Enter Student Name" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-center font-black text-xl mb-6 shadow-sm" />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-xs">Cancel</button>
            <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-200 hover:bg-blue-700">Confirm Assignment</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IssueModal({ locker, onClose, db, appId }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-md p-10 shadow-2xl">
        <h2 className="text-2xl font-black mb-2 tracking-tighter text-rose-600">Report Issue: #{locker?.lockerNumber}</h2>
        <p className="text-slate-500 font-medium mb-6">What needs fixing on this locker?</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const issue = new FormData(e.target).get('issue');
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'maintenance'), {
            lockerId: locker.id,
            lockerNumber: locker.lockerNumber,
            issue,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          onClose();
        }}>
          <textarea name="issue" required placeholder="e.g. Combination dial is stiff, door won't latch..." className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-medium min-h-[120px] mb-6" />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-xs">Discard</button>
            <button type="submit" className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-rose-200">Submit Report</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ onImport, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-md p-10 shadow-2xl text-center">
        <h2 className="text-3xl font-black mb-2 tracking-tighter">Bulk Import</h2>
        <p className="text-slate-500 font-medium mb-8 text-sm">Upload a CSV file with 8 columns: Number, Name, Set1, Set2, Set3, Set4, Set5, Location.</p>
        <div className="relative border-4 border-dashed border-slate-100 p-12 rounded-3xl hover:bg-blue-50 transition-all group cursor-pointer">
          <input type="file" accept=".csv" onChange={onImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <FileUp className="w-16 h-16 text-slate-200 mx-auto mb-4 group-hover:text-blue-300 transition-colors" />
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Select CSV File</p>
        </div>
        <button onClick={onClose} className="mt-8 text-slate-400 font-black uppercase tracking-widest text-xs hover:text-slate-600">Close</button>
      </div>
    </div>
  );
}