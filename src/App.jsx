import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, getDoc, setDoc, where, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

export default function MultiUserStatusTracker() {
  const firebaseConfig = {
    apiKey: "AIzaSyBiuX4eQjRXP-kRK0s8w-rxp3v2PJpR6SE",
    authDomain: "content-partnerships-status.firebaseapp.com",
    projectId: "content-partnerships-status",
    storageBucket: "content-partnerships-status.firebasestorage.app",
    messagingSenderId: "994875499391",
    appId: "1:994875499391:web:2ace01420b2ca38c9ab04a"
  };

  const appRef = useRef(null);
  const dbRef = useRef(null);
  const authRef = useRef(null);

  if (!appRef.current) {
    appRef.current = initializeApp(firebaseConfig);
    dbRef.current = getFirestore(appRef.current);
    authRef.current = getAuth(appRef.current);
  }

  const app = appRef.current;
  const db = dbRef.current;
  const auth = authRef.current;

  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [orgId, setOrgId] = useState(null);
  const [userRole, setUserRole] = useState('viewer');
  const [pos, setPos] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [geoFilter, setGeoFilter] = useState('All');

  const geoOptions = ['All', 'APAC', 'MEA', 'E&A', 'COE (Plan)'];

  const collapseAll = () => {
    setExpandedSections({});
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!user) return;
    
    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setOrgId(userData.orgId || 'default-org');
          setUserRole(userData.role || 'editor');
        } else {
          const defaultOrgId = 'default-org';
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            orgId: defaultOrgId,
            role: 'editor',
            createdAt: new Date().toISOString()
          });
          setOrgId(defaultOrgId);
          setUserRole('editor');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserProfile();
  }, [user, db]);

  useEffect(() => {
    if (!user || !orgId) return;
    
    const posQuery = query(collection(db, 'organizations', orgId, 'pos'));
    const unsubscribe = onSnapshot(posQuery, (snapshot) => {
      const posData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPos(posData.sort((a, b) => a.poNumber.localeCompare(b.poNumber)));
    });
    
    return () => unsubscribe();
  }, [user, orgId, db]);

  useEffect(() => {
    if (!user || !orgId) return;
    
    const presenceRef = doc(db, 'organizations', orgId, 'presence', user.uid);
    
    const setOnline = async () => {
      await setDoc(presenceRef, {
        email: user.email,
        lastSeen: serverTimestamp(),
        status: 'online'
      });
    };
    
    setOnline();
    
    return () => {
      updateDoc(presenceRef, { 
        status: 'offline',
        lastSeen: serverTimestamp()
      }).catch(() => {});
    };
  }, [user, orgId, db]);

  useEffect(() => {
    if (!orgId) return;
    
    const presenceQuery = query(
      collection(db, 'organizations', orgId, 'presence'),
      where('status', '==', 'online')
    );
    
    const unsubscribe = onSnapshot(presenceQuery, (snapshot) => {
      const users = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== user?.uid);
      setActiveUsers(users);
    });
    
    return () => unsubscribe();
  }, [orgId, user, db]);

  const calculateTotalCost = (campaigns) => {
    if (!campaigns || !Array.isArray(campaigns)) return 0;
    return campaigns.reduce((sum, campaign) => sum + (parseFloat(campaign.totalCost) || 0), 0);
  };

  const calculateRemainingAmount = (totalAmount, campaigns) => {
    return (parseFloat(totalAmount) || 0) - calculateTotalCost(campaigns);
  };

  const filteredPos = geoFilter === 'All' ? pos : pos.filter(po => po.geo === geoFilter);
  
  const calculateGeoTotals = () => {
    const posToCalculate = geoFilter === 'All' ? pos : filteredPos;
    const totalPlanned = posToCalculate.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
    const totalConsumed = posToCalculate.reduce((sum, po) => sum + calculateTotalCost(po.campaigns), 0);
    return { totalPlanned, totalConsumed };
  };

  const { totalPlanned, totalConsumed } = calculateGeoTotals();
  
  const toggleSection = (poId, section) => {
    setExpandedSections(prev => ({ ...prev, [`${poId}-${section}`]: !prev[`${poId}-${section}`] }));
  };

  const isSectionExpanded = (poId, section) => expandedSections[`${poId}-${section}`] === true;

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      alert(error.message);
    }
  };

  const addPO = async () => {
    if (!user || !orgId) return;
    if (userRole === 'viewer') {
      alert('You do not have permission to add POs. Contact your administrator.');
      return;
    }
    try {
      await addDoc(collection(db, 'organizations', orgId, 'pos'), {
        poNumber: `PO-${String(pos.length + 1).padStart(3, '0')}`,
        poName: '',
        geo: 'APAC',
        expiryDate: '',
        totalAmount: '',
        campaigns: [],
        invoicing: {
          invoice50: { notStarted: true, shared: false, toBeApproved: false, approved: false, claimNumber: '' },
          coc30: { checked: false, sharedOn: '' },
          invoice30: { notStarted: true, shared: false, toBeApproved: false, approved: false, claimNumber: '' },
          coc20: { checked: false, sharedOn: '' },
          invoice20: { notStarted: true, shared: false, toBeApproved: false, approved: false, claimNumber: '' }
        },
        projectStatus: { inPlanning: false, live: false, completed: false },
        createdAt: new Date().toISOString(),
        createdBy: user.email
      });
    } catch (error) {
      console.error('Error adding PO:', error);
      alert('Failed to add PO: ' + error.message);
    }
  };

  const deletePO = async (id) => {
    if (!user || !orgId) return;
    if (userRole !== 'admin') {
      alert('Only admins can delete POs.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this PO? This will affect all users.')) return;
    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'pos', id));
    } catch (error) {
      console.error('Error deleting PO:', error);
      alert('Failed to delete PO: ' + error.message);
    }
  };

  const updatePOField = async (id, field, value) => {
    if (!user || !orgId) return;
    if (userRole === 'viewer') return;
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'pos', id), { 
        [field]: value,
        lastModifiedBy: user.email,
        lastModifiedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating PO field:', error);
    }
  };

  const addCampaign = async (poId) => {
    if (!user || !orgId) return;
    if (userRole === 'viewer') {
      alert('You do not have permission to add campaigns.');
      return;
    }
    const po = pos.find(p => p.id === poId);
    if (!po) return;
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'pos', poId), {
        campaigns: [...(po.campaigns || []), {
          id: Date.now(),
          name: '',
          supplier: '',
          totalCost: '',
          proposal: 'Not Started',
          status: 'Not LIVE',
          boShared: 'no',
          trackerShared: 'no',
          nextSteps: '',
          deadline: ''
        }],
        lastModifiedBy: user.email,
        lastModifiedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding campaign:', error);
      alert('Failed to add campaign: ' + error.message);
    }
  };

  const deleteCampaign = async (poId, campaignId) => {
    if (!user || !orgId) return;
    if (userRole === 'viewer') {
      alert('You do not have permission to delete campaigns.');
      return;
    }
    const po = pos.find(p => p.id === poId);
    if (!po) return;
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'pos', poId), {
        campaigns: (po.campaigns || []).filter(c => c.id !== campaignId),
        lastModifiedBy: user.email,
        lastModifiedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Failed to delete campaign: ' + error.message);
    }
  };

  const updateCampaign = async (poId, campaignId, field, value) => {
    if (!user || !orgId) return;
    if (userRole === 'viewer') return;
    const po = pos.find(p => p.id === poId);
    if (!po) return;
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'pos', poId), {
        campaigns: (po.campaigns || []).map(c => c.id === campaignId ? { ...c, [field]: value } : c),
        lastModifiedBy: user.email,
        lastModifiedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating campaign:', error);
    }
  };

  const updateInvoicing = async (id, field, key, value) => {
    if (!user || !orgId) return;
    if (userRole === 'viewer') return;
    const po = pos.find(p => p.id === id);
    if (!po) return;

    let updatedInvoicing = { ...po.invoicing, [field]: { ...po.invoicing[field], [key]: value } };

    if (['invoice50', 'invoice30', 'invoice20'].includes(field)) {
      if (key === 'notStarted' && value) {
        updatedInvoicing[field] = { ...updatedInvoicing[field], notStarted: true, shared: false, toBeApproved: false, approved: false };
      } else if (key === 'shared' && value) {
        updatedInvoicing[field] = { ...updatedInvoicing[field], notStarted: false, shared: true, toBeApproved: false, approved: false };
      } else if (key === 'toBeApproved' && value) {
        updatedInvoicing[field] = { ...updatedInvoicing[field], notStarted: false, shared: false, toBeApproved: true, approved: false };
      } else if (key === 'approved' && value) {
        updatedInvoicing[field] = { ...updatedInvoicing[field], notStarted: false, shared: false, toBeApproved: false, approved: true };
      }
    }

    const updatedStatus = { ...po.projectStatus };
    
    if (field === 'invoice50' && key === 'shared' && value) {
      updatedStatus.inPlanning = true;
    }
    if (field === 'coc30' && key === 'checked' && value) {
      updatedStatus.live = true;
    }

    try {
      await updateDoc(doc(db, 'organizations', orgId, 'pos', id), {
        invoicing: updatedInvoicing,
        projectStatus: updatedStatus,
        lastModifiedBy: user.email,
        lastModifiedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating invoicing:', error);
    }
  };

  const updateProjectStatus = async (id, field, value) => {
    if (!user || !orgId) return;
    if (userRole === 'viewer') return;
    const po = pos.find(p => p.id === id);
    if (!po) return;
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'pos', id), {
        projectStatus: { ...po.projectStatus, [field]: value },
        lastModifiedBy: user.email,
        lastModifiedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };

  const exportToCSV = () => {
    let csv = 'PO Number,PO Name,GEO,Expiry Date,Total Amount,Total Spent,Remaining\n';
    pos.forEach(po => {
      const totalSpent = calculateTotalCost(po.campaigns);
      const remaining = calculateRemainingAmount(po.totalAmount, po.campaigns);
      csv += `${po.poNumber},"${po.poName}",${po.geo},${po.expiryDate},${po.totalAmount},${totalSpent},${remaining}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `status_tracker_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Sign In</h1>
          <p className="text-sm text-gray-600 mb-6">Access your organization's shared tracker</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSignIn(e);
                  }
                }}
                className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={handleSignIn}
              className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-medium"
            >
              Sign In
            </button>
          </div>
          <p className="mt-6 text-xs text-gray-500 text-center">Need an account? Contact admin@omc.com</p>
        </div>
      </div>
    );
  }

  const isReadOnly = userRole === 'viewer';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Client Project Status Tracker</h1>
            <p className="text-sm text-gray-500 mt-1">Organization: {orgId} • Role: <span className="font-medium capitalize">{userRole}</span></p>
          </div>
          <div className="flex gap-3 items-center">
            {activeUsers.length > 0 && (
              <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
                <Users size={16} className="text-green-600" />
                <span className="text-sm text-green-700 font-medium">
                  {activeUsers.length} online
                </span>
                <div className="flex -space-x-2 ml-1">
                  {activeUsers.slice(0, 3).map((u, i) => (
                    <div
                      key={i}
                      title={u.email}
                      className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs border-2 border-white font-medium"
                    >
                      {u.email[0].toUpperCase()}
                    </div>
                  ))}
                  {activeUsers.length > 3 && (
                    <div className="w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center text-xs border-2 border-white">
                      +{activeUsers.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={collapseAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              title="Collapse all sections"
            >
              Collapse All
            </button>
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Sign Out
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Download size={18} />
              Export CSV
            </button>
            {!isReadOnly && (
              <button
                onClick={addPO}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Plus size={18} />
                Add PO
              </button>
            )}
          </div>
        </div>

        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>View-only mode:</strong> You can view all data but cannot make changes. Contact your administrator for edit access.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-gray-700">Filter by GEO:</label>
              <div className="flex gap-2">
                {geoOptions.map(geo => (
                  <button
                    key={geo}
                    onClick={() => setGeoFilter(geo)}
                    className={`px-4 py-2 rounded-lg transition ${
                      geoFilter === geo
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {geo}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium mb-1">
                Total Planned Budget {geoFilter !== 'All' ? `(${geoFilter})` : '(All Regions)'}
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {totalPlanned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-sm text-indigo-600 font-medium mb-1">
                Total Consumed Budget {geoFilter !== 'All' ? `(${geoFilter})` : '(All Regions)'}
              </div>
              <div className="text-2xl font-bold text-indigo-700">
                {totalConsumed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {filteredPos.map(po => {
            const totalSpent = calculateTotalCost(po.campaigns);
            const remaining = calculateRemainingAmount(po.totalAmount, po.campaigns);
            return (
              <div key={po.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                  <button
                    onClick={() => toggleSection(po.id, 'header')}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-xl font-bold">{po.poNumber}</h2>
                      {po.poName && <span className="text-purple-100">- {po.poName}</span>}
                      <span className="text-sm bg-white/20 px-3 py-1 rounded-full">{po.geo}</span>
                      {po.lastModifiedBy && (
                        <span className="text-xs text-purple-200">
                          Last edited by {po.lastModifiedBy.split('@')[0]}
                        </span>
                      )}
                      <div className="flex-1 max-w-md ml-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-white/20 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                po.projectStatus.completed
                                  ? 'bg-purple-400 w-full'
                                  : po.projectStatus.live
                                  ? 'bg-green-400 w-2/3'
                                  : po.projectStatus.inPlanning
                                  ? 'bg-purple-300 w-1/3'
                                  : 'bg-gray-400 w-0'
                              }`}
                            />
                          </div>
                          <span className="text-xs text-purple-100 min-w-[80px]">
                            {po.projectStatus.completed
                              ? 'Completed'
                              : po.projectStatus.live
                              ? 'LIVE'
                              : po.projectStatus.inPlanning
                              ? 'Planning'
                              : 'Not Started'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isSectionExpanded(po.id, 'header') ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                  </button>
                  {isSectionExpanded(po.id, 'header') && (
                    <div className="p-6 pt-2">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="text-xs text-purple-100 block mb-1">PO Number</label>
                            <input
                              type="text"
                              value={po.poNumber}
                              onChange={(e) => updatePOField(po.id, 'poNumber', e.target.value)}
                              disabled={isReadOnly}
                              className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-purple-100 block mb-1">PO Name</label>
                            <input
                              type="text"
                              value={po.poName}
                              onChange={(e) => updatePOField(po.id, 'poName', e.target.value)}
                              disabled={isReadOnly}
                              className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                              placeholder="Enter PO name"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-purple-100 block mb-1">GEO</label>
                            <select
                              value={po.geo}
                              onChange={(e) => updatePOField(po.id, 'geo', e.target.value)}
                              disabled={isReadOnly}
                              className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white focus:outline-none focus:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="APAC" className="text-gray-800">APAC</option>
                              <option value="MEA" className="text-gray-800">MEA</option>
                              <option value="E&A" className="text-gray-800">E&A</option>
                              <option value="COE (Plan)" className="text-gray-800">COE (Plan)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-purple-100 block mb-1">Expiry Date</label>
                            <input
                              type="date"
                              value={po.expiryDate}
                              onChange={(e) => updatePOField(po.id, 'expiryDate', e.target.value)}
                              disabled={isReadOnly}
                              className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white focus:outline-none focus:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => deletePO(po.id)}
                            className="ml-4 p-2 text-white hover:bg-white/20 rounded-lg transition"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-purple-100 block mb-1">PO Total Amount (SAR)</label>
                          <input
                            type="number"
                            value={po.totalAmount}
                            onChange={(e) => updatePOField(po.id, 'totalAmount', e.target.value)}
                            disabled={isReadOnly}
                            className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="bg-white/20 rounded p-3">
                          <div className="text-xs text-purple-100 mb-1">Total Spent</div>
                          <div className="text-xl font-bold">
                            {totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                          </div>
                        </div>
                        <div className={`rounded p-3 ${remaining < 0 ? 'bg-red-500' : 'bg-white/20'}`}>
                          <div className="text-xs text-purple-100 mb-1">Remaining</div>
                          <div className="text-xl font-bold">
                            {remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/20">
                        <label className="text-xs text-purple-100 block mb-2">Project Status</label>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={po.projectStatus.inPlanning}
                              disabled={po.invoicing.invoice50.shared || isReadOnly}
                              onChange={(e) => updateProjectStatus(po.id, 'inPlanning', e.target.checked)}
                              className="w-4 h-4 text-purple-400"
                            />
                            <span className="text-sm text-purple-100">In Planning</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={po.projectStatus.live}
                              disabled={po.invoicing.coc30.checked || isReadOnly}
                              onChange={(e) => updateProjectStatus(po.id, 'live', e.target.checked)}
                              className="w-4 h-4 text-green-400"
                            />
                            <span className="text-sm text-purple-100">LIVE</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={po.projectStatus.completed}
                              disabled={isReadOnly}
                              onChange={(e) => updateProjectStatus(po.id, 'completed', e.target.checked)}
                              className="w-4 h-4 text-purple-400"
                            />
                            <span className="text-sm text-purple-100">Completed</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-b border-gray-200">
                  <button
                    onClick={() => toggleSection(po.id, 'invoicing')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                  >
                    <h3 className="text-lg font-semibold text-gray-800">1. Invoicing & COCs</h3>
                    {isSectionExpanded(po.id, 'invoicing') ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  {isSectionExpanded(po.id, 'invoicing') && (
                    <div className="p-6 space-y-6">
                      {['invoice50', 'invoice30', 'invoice20'].map((inv, idx) => (
                        <div key={inv} className="border-l-4 border-purple-500 pl-4">
                          <h4 className="font-semibold text-gray-800 mb-3">{['50', '30', '20'][idx]}% Invoice</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={po.invoicing[inv].notStarted}
                                onChange={(e) => updateInvoicing(po.id, inv, 'notStarted', e.target.checked)}
                                disabled={isReadOnly}
                                className="w-4 h-4 text-gray-600"
                              />
                              <span className="text-sm text-gray-700">Not Started</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={po.invoicing[inv].shared}
                                onChange={(e) => updateInvoicing(po.id, inv, 'shared', e.target.checked)}
                                disabled={isReadOnly}
                                className="w-4 h-4 text-purple-600"
                              />
                              <span className="text-sm text-gray-700">Shared</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={po.invoicing[inv].toBeApproved}
                                onChange={(e) => updateInvoicing(po.id, inv, 'toBeApproved', e.target.checked)}
                                disabled={isReadOnly}
                                className="w-4 h-4 text-orange-600"
                              />
                              <span className="text-sm text-gray-700 flex-1">To be approved by PM on ERP</span>
                              {po.invoicing[inv].toBeApproved && (
                                <input
                                  type="text"
                                  value={po.invoicing[inv].claimNumber || ''}
                                  onChange={(e) => updateInvoicing(po.id, inv, 'claimNumber', e.target.value)}
                                  disabled={isReadOnly}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm w-32 disabled:opacity-50 disabled:cursor-not-allowed"
                                  placeholder="Claim #"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={po.invoicing[inv].approved}
                                onChange={(e) => updateInvoicing(po.id, inv, 'approved', e.target.checked)}
                                disabled={isReadOnly}
                                className="w-4 h-4 text-green-600"
                              />
                              <span className="text-sm text-gray-700">Approved by PM on ERP</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="border-l-4 border-purple-500 pl-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={po.invoicing.coc30.checked}
                            onChange={(e) => updateInvoicing(po.id, 'coc30', 'checked', e.target.checked)}
                            disabled={isReadOnly}
                            className="w-4 h-4 text-purple-600"
                          />
                          <span className="text-sm font-semibold text-gray-800 flex-1">30% COC</span>
                          <input
                            type="date"
                            value={po.invoicing.coc30.sharedOn || ''}
                            onChange={(e) => updateInvoicing(po.id, 'coc30', 'sharedOn', e.target.value)}
                            disabled={isReadOnly}
                            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                      <div className="border-l-4 border-purple-500 pl-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={po.invoicing.coc20.checked}
                            onChange={(e) => updateInvoicing(po.id, 'coc20', 'checked', e.target.checked)}
                            disabled={isReadOnly}
                            className="w-4 h-4 text-purple-600"
                          />
                          <span className="text-sm font-semibold text-gray-800 flex-1">20% COC</span>
                          <input
                            type="date"
                            value={po.invoicing.coc20.sharedOn || ''}
                            onChange={(e) => updateInvoicing(po.id, 'coc20', 'sharedOn', e.target.value)}
                            disabled={isReadOnly}
                            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => toggleSection(po.id, 'campaigns')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                  >
                    <h3 className="text-lg font-semibold text-gray-800">
                      2. Campaigns ({po.campaigns?.length || 0})
                    </h3>
                    {isSectionExpanded(po.id, 'campaigns') ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  {isSectionExpanded(po.id, 'campaigns') && (
                    <div className="p-4 bg-gray-50">
                      {!isReadOnly && (
                        <button
                          onClick={() => addCampaign(po.id)}
                          className="mb-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                        >
                          <Plus size={16} />
                          Add Campaign
                        </button>
                      )}
                      <div className="space-y-4">
                        {(po.campaigns || []).map(campaign => (
                          <div key={campaign.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="font-semibold text-gray-700">Campaign Details</h4>
                              {!isReadOnly && (
                                <button
                                  onClick={() => deleteCampaign(po.id, campaign.id)}
                                  className="text-red-500 hover:bg-red-50 p-1 rounded"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Campaign Name</label>
                                <input
                                  type="text"
                                  value={campaign.name}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'name', e.target.value)}
                                  disabled={isReadOnly}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  placeholder="Enter campaign name"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Supplier Name</label>
                                <input
                                  type="text"
                                  value={campaign.supplier}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'supplier', e.target.value)}
                                  disabled={isReadOnly}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  placeholder="Enter supplier name"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Total Cost to Client (SAR)</label>
                                <input
                                  type="number"
                                  value={campaign.totalCost}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'totalCost', e.target.value)}
                                  disabled={isReadOnly}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Status</label>
                                <select
                                  value={campaign.status}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'status', e.target.value)}
                                  disabled={isReadOnly}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <option value="Not LIVE">Not LIVE</option>
                                  <option value="LIVE">LIVE</option>
                                  <option value="Completed">Completed</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Proposal</label>
                                <select
                                  value={campaign.proposal}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'proposal', e.target.value)}
                                  disabled={isReadOnly}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <option value="Not Started">Not Started</option>
                                  <option value="Requested">Requested</option>
                                  <option value="Pending PM approval">Pending PM approval</option>
                                  <option value="Approved by PM">Approved by PM</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">BO Shared</label>
                                <select
                                  value={campaign.boShared}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'boShared', e.target.value)}
                                  disabled={isReadOnly}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <option value="no">No</option>
                                  <option value="yes">Yes</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Tracker Shared</label>
                                <select
                                  value={campaign.trackerShared}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'trackerShared', e.target.value)}
                                  disabled={isReadOnly}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <option value="no">No</option>
                                  <option value="yes">Yes</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="text-xs text-gray-600 block mb-1">Next Steps</label>
                                <textarea
                                  value={campaign.nextSteps}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'nextSteps', e.target.value)}
                                  disabled={isReadOnly}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  rows="3"
                                  placeholder="Enter next steps..."
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Deadline Date</label>
                                <input
                                  type="date"
                                  value={campaign.deadline}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'deadline', e.target.value)}
                                  disabled={isReadOnly}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        {(!po.campaigns || po.campaigns.length === 0) && (
                          <div className="text-center py-8 text-gray-400">
                            No campaigns added yet. Click "Add Campaign" to get started.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredPos.length === 0 && pos.length > 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-4">No POs found for {geoFilter}</p>
            <button
              onClick={() => setGeoFilter('All')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Show All POs
            </button>
          </div>
        )}

        {pos.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-4">No POs added yet</p>
            <button
              onClick={addPO}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Add Your First PO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
Fix: Complete working code
