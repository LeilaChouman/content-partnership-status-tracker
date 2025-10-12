const ALLOWED_DOMAIN = [
    '@omc.com',
  '@sta.go.sa'
  ];

const handleSignUp = async (e) => {
  e.preventDefault();
  
  // Check if email is from allowed domain
  if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
    alert(`Only ${ALLOWED_DOMAIN} emails are allowed.`);
    return;
  }
  
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    setEmail('');
    setPassword('');
  } catch (error) {
    alert(error.message);
  }
};

import { useState, useEffect } from 'react';
import { Plus, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';

// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

export default function StatusTracker() {
  // Initialize Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyBiuX4eQjRXP-kRK0s8w-rxp3v2PJpR6SE",
    authDomain: "content-partnerships-status.firebaseapp.com",
    projectId: "content-partnerships-status",
    storageBucket: "content-partnerships-status.firebasestorage.app",
    messagingSenderId: "994875499391",
    appId: "1:994875499391:web:2ace01420b2ca38c9ab04a"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Auth state
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // App state
  const [pos, setPos] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [geoFilter, setGeoFilter] = useState('All');

  const geoOptions = ['All', 'APAC', 'MEA', 'E&A', 'COE (Plan)'];

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load POs from Firebase
  useEffect(() => {
    if (!user) return;

    const posQuery = query(
      collection(db, 'users', user.uid, 'pos')
    );

    const unsubscribe = onSnapshot(posQuery, (snapshot) => {
      const posData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPos(posData.sort((a, b) => a.poNumber.localeCompare(b.poNumber)));
    });

    return () => unsubscribe();
  }, [user]);

  const calculateTotalCost = (campaigns) => {
    return campaigns.reduce((sum, campaign) => {
      const cost = parseFloat(campaign.totalCost) || 0;
      return sum + cost;
    }, 0);
  };

  const calculateRemainingAmount = (totalAmount, campaigns) => {
    const total = parseFloat(totalAmount) || 0;
    const spent = calculateTotalCost(campaigns);
    return total - spent;
  };

  const filteredPos = geoFilter === 'All' 
    ? pos 
    : pos.filter(po => po.geo === geoFilter);

  const calculateGeoTotals = () => {
    const posToCalculate = geoFilter === 'All' ? pos : filteredPos;
    
    const totalPlanned = posToCalculate.reduce((sum, po) => {
      return sum + (parseFloat(po.totalAmount) || 0);
    }, 0);
    
    const totalConsumed = posToCalculate.reduce((sum, po) => {
      const poConsumed = calculateTotalCost(po.campaigns);
      return sum + poConsumed;
    }, 0);
    
    return { totalPlanned, totalConsumed };
  };

  const { totalPlanned, totalConsumed } = calculateGeoTotals();

  const toggleSection = (poId, section) => {
    setExpandedSections(prev => ({
      ...prev,
      [`${poId}-${section}`]: !prev[`${poId}-${section}`]
    }));
  };

  const isSectionExpanded = (poId, section) => {
    return expandedSections[`${poId}-${section}`] === true;
  };

  // Auth functions
  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
    } catch (error) {
      alert(error.message);
    }
  };

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
    await signOut(auth);
  };

  // CRUD functions
  const addPO = async () => {
    if (!user) return;

    const newPO = {
      poNumber: `PO-${String(pos.length + 1).padStart(3, '0')}`,
      poName: '',
      geo: 'APAC',
      expiryDate: '',
      totalAmount: '',
      campaigns: [],
      invoicing: {
        invoice50: {
          notStarted: true,
          shared: false,
          toBeApproved: false,
          approved: false,
          claimNumber: ''
        },
        coc30: { checked: false, sharedOn: '' },
        invoice30: {
          notStarted: true,
          shared: false,
          toBeApproved: false,
          approved: false,
          claimNumber: ''
        },
        coc20: { checked: false, sharedOn: '' },
        invoice20: {
          notStarted: true,
          shared: false,
          toBeApproved: false,
          approved: false,
          claimNumber: ''
        }
      },
      projectStatus: {
        inPlanning: false,
        live: false,
        completed: false
      },
      createdAt: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'users', user.uid, 'pos'), newPO);
  };

  const deletePO = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'pos', id));
  };

  const updatePOField = async (id, field, value) => {
    if (!user) return;
    const poRef = doc(db, 'users', user.uid, 'pos', id);
    await updateDoc(poRef, { [field]: value });
  };

  const addCampaign = async (poId) => {
    if (!user) return;
    const po = pos.find(p => p.id === poId);
    if (!po) return;

    const newCampaign = {
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
    };

    const poRef = doc(db, 'users', user.uid, 'pos', poId);
    await updateDoc(poRef, {
      campaigns: [...po.campaigns, newCampaign]
    });
  };

  const deleteCampaign = async (poId, campaignId) => {
    if (!user) return;
    const po = pos.find(p => p.id === poId);
    if (!po) return;

    const poRef = doc(db, 'users', user.uid, 'pos', poId);
    await updateDoc(poRef, {
      campaigns: po.campaigns.filter(c => c.id !== campaignId)
    });
  };

  const updateCampaign = async (poId, campaignId, field, value) => {
    if (!user) return;
    const po = pos.find(p => p.id === poId);
    if (!po) return;

    const poRef = doc(db, 'users', user.uid, 'pos', poId);
    await updateDoc(poRef, {
      campaigns: po.campaigns.map(c => 
        c.id === campaignId ? { ...c, [field]: value } : c
      )
    });
  };

  const updateInvoicing = async (id, field, key, value) => {
    if (!user) return;
    const po = pos.find(p => p.id === id);
    if (!po) return;

    const updatedInvoicing = {
      ...po.invoicing,
      [field]: {
        ...po.invoicing[field],
        [key]: value
      }
    };

    if (['invoice50', 'invoice30', 'invoice20'].includes(field)) {
      if (key === 'notStarted' && value) {
        updatedInvoicing[field] = {
          ...updatedInvoicing[field],
          notStarted: true,
          shared: false,
          toBeApproved: false,
          approved: false
        };
      } else if (key === 'shared' && value) {
        updatedInvoicing[field] = {
          ...updatedInvoicing[field],
          notStarted: false,
          shared: true,
          toBeApproved: false,
          approved: false
        };
      } else if (key === 'toBeApproved' && value) {
        updatedInvoicing[field] = {
          ...updatedInvoicing[field],
          notStarted: false,
          shared: false,
          toBeApproved: true,
          approved: false
        };
      } else if (key === 'approved' && value) {
        updatedInvoicing[field] = {
          ...updatedInvoicing[field],
          notStarted: false,
          shared: false,
          toBeApproved: false,
          approved: true
        };
      }
    }

    const updatedStatus = { ...po.projectStatus };
    
    if (field === 'invoice50' && key === 'shared' && value) {
      updatedStatus.inPlanning = true;
    }
    
    if (field === 'coc30' && key === 'checked' && value) {
      updatedStatus.live = true;
    }

    const poRef = doc(db, 'users', user.uid, 'pos', id);
    await updateDoc(poRef, { 
      invoicing: updatedInvoicing,
      projectStatus: updatedStatus
    });
  };

  const updateProjectStatus = async (id, field, value) => {
    if (!user) return;
    const po = pos.find(p => p.id === id);
    if (!po) return;

    const poRef = doc(db, 'users', user.uid, 'pos', id);
    await updateDoc(poRef, {
      projectStatus: { ...po.projectStatus, [field]: value }
    });
  };

  const exportToCSV = () => {
    let csv = 'PO Number,PO Name,GEO,Expiry Date,Total Amount,Total Spent,Remaining,Item,Details\n';
    
    pos.forEach(po => {
      const totalSpent = calculateTotalCost(po.campaigns);
      const remaining = calculateRemainingAmount(po.totalAmount, po.campaigns);
      
      csv += `${po.poNumber},${po.poName},${po.geo},${po.expiryDate},${po.totalAmount},${totalSpent},${remaining},,\n`;
      
      po.campaigns.forEach(campaign => {
        csv += `${po.poNumber},,,,,,"Campaign: ${campaign.name}","Supplier: ${campaign.supplier}, Cost: ${campaign.totalCost} SAR, Proposal: ${campaign.proposal}"\n`;
      });
      
      csv += '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'status_tracker.csv';
    a.click();
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h1>
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-medium"
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="mt-4 text-purple-600 text-sm hover:text-purple-700"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Client Project Status Tracker</h1>
          <div className="flex gap-3 items-center">
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
            <button
              onClick={addPO}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Plus size={18} />
              Add PO
            </button>
          </div>
        </div>

        {/* GEO Filter */}
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
              {geoFilter !== 'All' && (
                <span className="text-sm text-gray-500">
                  Showing {filteredPos.length} of {pos.length} POs
                </span>
              )}
            </div>
            <button
              onClick={addPO}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <Plus size={18} />
              Add New PO
            </button>
          </div>
          
          {/* Budget Summary */}
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
                {/* PO Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                  <button
                    onClick={() => toggleSection(po.id, 'header')}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-xl font-bold">{po.poNumber}</h2>
                      {po.poName && <span className="text-purple-100">- {po.poName}</span>}
                      <span className="text-sm bg-white/20 px-3 py-1 rounded-full">{po.geo}</span>
                      
                      {/* Project Status Progress Bar */}
                      <div className="flex-1 max-w-md ml-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-white/20 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                po.projectStatus.completed ? 'bg-purple-400 w-full' :
                                po.projectStatus.live ? 'bg-green-400 w-2/3' :
                                po.projectStatus.inPlanning ? 'bg-purple-300 w-1/3' :
                                'bg-gray-400 w-0'
                              }`}
                            />
                          </div>
                          <span className="text-xs text-purple-100 min-w-[80px]">
                            {po.projectStatus.completed ? 'Completed' :
                             po.projectStatus.live ? 'LIVE' :
                             po.projectStatus.inPlanning ? 'Planning' :
                             'Not Started'}
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
                              className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:bg-white/30"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-purple-100 block mb-1">PO Name</label>
                            <input
                              type="text"
                              value={po.poName}
                              onChange={(e) => updatePOField(po.id, 'poName', e.target.value)}
                              className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:bg-white/30"
                              placeholder="Enter PO name"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-purple-100 block mb-1">GEO</label>
                            <select
                              value={po.geo}
                              onChange={(e) => updatePOField(po.id, 'geo', e.target.value)}
                              className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white focus:outline-none focus:bg-white/30"
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
                              className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white focus:outline-none focus:bg-white/30"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => deletePO(po.id)}
                          className="ml-4 p-2 text-white hover:bg-white/20 rounded-lg transition"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-purple-100 block mb-1">PO Total Amount (SAR)</label>
                          <input
                            type="number"
                            value={po.totalAmount}
                            onChange={(e) => updatePOField(po.id, 'totalAmount', e.target.value)}
                            className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:bg-white/30"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="bg-white/20 rounded p-3">
                          <div className="text-xs text-purple-100 mb-1">Total Spent</div>
                          <div className="text-xl font-bold">{totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</div>
                        </div>
                        <div className={`rounded p-3 ${remaining < 0 ? 'bg-red-500' : 'bg-white/20'}`}>
                          <div className="text-xs text-purple-100 mb-1">Remaining</div>
                          <div className="text-xl font-bold">{remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</div>
                        </div>
                      </div>
                      
                      {/* Project Status Controls */}
                      <div className="mt-4 pt-4 border-t border-white/20">
                        <label className="text-xs text-purple-100 block mb-2">Project Status</label>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={po.projectStatus.inPlanning}
                              disabled={po.invoicing.invoice50.shared}
                              onChange={(e) => updateProjectStatus(po.id, 'inPlanning', e.target.checked)}
                              className="w-4 h-4 text-purple-400"
                            />
                            <span className="text-sm text-purple-100">In Planning</span>
                            {po.invoicing.invoice50.shared && (
                              <span className="text-xs bg-purple-400/30 px-2 py-0.5 rounded">Auto</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={po.projectStatus.live}
                              disabled={po.invoicing.coc30.checked}
                              onChange={(e) => updateProjectStatus(po.id, 'live', e.target.checked)}
                              className="w-4 h-4 text-green-400"
                            />
                            <span className="text-sm text-purple-100">LIVE</span>
                            {po.invoicing.coc30.checked && (
                              <span className="text-xs bg-green-400/30 px-2 py-0.5 rounded">Auto</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={po.projectStatus.completed}
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

                {/* Invoicing Section */}
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
                      {/* 50% Invoice Section */}
                      <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-semibold text-gray-800 mb-3">50% Invoice</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice50.notStarted}
                              onChange={(e) => updateInvoicing(po.id, 'invoice50', 'notStarted', e.target.checked)}
                              className="w-4 h-4 text-gray-600"
                            />
                            <span className="text-sm text-gray-700">Not Started</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice50.shared}
                              onChange={(e) => updateInvoicing(po.id, 'invoice50', 'shared', e.target.checked)}
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm text-gray-700">Shared</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice50.toBeApproved}
                              onChange={(e) => updateInvoicing(po.id, 'invoice50', 'toBeApproved', e.target.checked)}
                              className="w-4 h-4 text-orange-600"
                            />
                            <span className="text-sm text-gray-700 flex-1">To be approved by PM on ERP</span>
                            {po.invoicing.invoice50.toBeApproved && (
                              <input
                                type="text"
                                value={po.invoicing.invoice50.claimNumber}
                                onChange={(e) => updateInvoicing(po.id, 'invoice50', 'claimNumber', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
                                placeholder="Claim #"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice50.approved}
                              onChange={(e) => updateInvoicing(po.id, 'invoice50', 'approved', e.target.checked)}
                              className="w-4 h-4 text-green-600"
                            />
                            <span className="text-sm text-gray-700">Approved by PM on ERP</span>
                          </div>
                        </div>
                      </div>

                      {/* 30% COC */}
                      <div className="border-l-4 border-purple-500 pl-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={po.invoicing.coc30.checked}
                            onChange={(e) => updateInvoicing(po.id, 'coc30', 'checked', e.target.checked)}
                            className="w-4 h-4 text-purple-600"
                          />
                          <span className="text-sm font-semibold text-gray-800 flex-1">30% COC</span>
                          <input
                            type="date"
                            value={po.invoicing.coc30.sharedOn}
                            onChange={(e) => updateInvoicing(po.id, 'coc30', 'sharedOn', e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </div>
                      </div>

                      {/* 30% Invoice Section */}
                      <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-semibold text-gray-800 mb-3">30% Invoice</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice30.notStarted}
                              onChange={(e) => updateInvoicing(po.id, 'invoice30', 'notStarted', e.target.checked)}
                              className="w-4 h-4 text-gray-600"
                            />
                            <span className="text-sm text-gray-700">Not Started</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice30.shared}
                              onChange={(e) => updateInvoicing(po.id, 'invoice30', 'shared', e.target.checked)}
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm text-gray-700">Shared</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice30.toBeApproved}
                              onChange={(e) => updateInvoicing(po.id, 'invoice30', 'toBeApproved', e.target.checked)}
                              className="w-4 h-4 text-orange-600"
                            />
                            <span className="text-sm text-gray-700 flex-1">To be approved by PM on ERP</span>
                            {po.invoicing.invoice30.toBeApproved && (
                              <input
                                type="text"
                                value={po.invoicing.invoice30.claimNumber}
                                onChange={(e) => updateInvoicing(po.id, 'invoice30', 'claimNumber', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
                                placeholder="Claim #"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice30.approved}
                              onChange={(e) => updateInvoicing(po.id, 'invoice30', 'approved', e.target.checked)}
                              className="w-4 h-4 text-green-600"
                            />
                            <span className="text-sm text-gray-700">Approved by PM on ERP</span>
                          </div>
                        </div>
                      </div>

                      {/* 20% COC */}
                      <div className="border-l-4 border-purple-500 pl-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={po.invoicing.coc20.checked}
                            onChange={(e) => updateInvoicing(po.id, 'coc20', 'checked', e.target.checked)}
                            className="w-4 h-4 text-purple-600"
                          />
                          <span className="text-sm font-semibold text-gray-800 flex-1">20% COC</span>
                          <input
                            type="date"
                            value={po.invoicing.coc20.sharedOn}
                            onChange={(e) => updateInvoicing(po.id, 'coc20', 'sharedOn', e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </div>
                      </div>

                      {/* 20% Invoice Section */}
                      <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-semibold text-gray-800 mb-3">20% Invoice</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice20.notStarted}
                              onChange={(e) => updateInvoicing(po.id, 'invoice20', 'notStarted', e.target.checked)}
                              className="w-4 h-4 text-gray-600"
                            />
                            <span className="text-sm text-gray-700">Not Started</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice20.shared}
                              onChange={(e) => updateInvoicing(po.id, 'invoice20', 'shared', e.target.checked)}
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm text-gray-700">Shared</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice20.toBeApproved}
                              onChange={(e) => updateInvoicing(po.id, 'invoice20', 'toBeApproved', e.target.checked)}
                              className="w-4 h-4 text-orange-600"
                            />
                            <span className="text-sm text-gray-700 flex-1">To be approved by PM on ERP</span>
                            {po.invoicing.invoice20.toBeApproved && (
                              <input
                                type="text"
                                value={po.invoicing.invoice20.claimNumber}
                                onChange={(e) => updateInvoicing(po.id, 'invoice20', 'claimNumber', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
                                placeholder="Claim #"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={po.invoicing.invoice20.approved}
                              onChange={(e) => updateInvoicing(po.id, 'invoice20', 'approved', e.target.checked)}
                              className="w-4 h-4 text-green-600"
                            />
                            <span className="text-sm text-gray-700">Approved by PM on ERP</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Campaigns Section */}
                <div>
                  <button
                    onClick={() => toggleSection(po.id, 'campaigns')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                  >
                    <h3 className="text-lg font-semibold text-gray-800">2. Campaigns ({po.campaigns.length})</h3>
                    {isSectionExpanded(po.id, 'campaigns') ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  
                  {isSectionExpanded(po.id, 'campaigns') && (
                    <div className="p-4 bg-gray-50">
                      <button
                        onClick={() => addCampaign(po.id)}
                        className="mb-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                      >
                        <Plus size={16} />
                        Add Campaign
                      </button>

                      <div className="space-y-4">
                        {po.campaigns.map(campaign => (
                          <div key={campaign.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="font-semibold text-gray-700">Campaign Details</h4>
                              <button
                                onClick={() => deleteCampaign(po.id, campaign.id)}
                                className="text-red-500 hover:bg-red-50 p-1 rounded"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Campaign Name</label>
                                <input
                                  type="text"
                                  value={campaign.name}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'name', e.target.value)}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                  placeholder="Enter campaign name"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Supplier Name</label>
                                <input
                                  type="text"
                                  value={campaign.supplier}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'supplier', e.target.value)}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                  placeholder="Enter supplier name"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Total Cost to Client (SAR)</label>
                                <input
                                  type="number"
                                  value={campaign.totalCost}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'totalCost', e.target.value)}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                  placeholder="0.00"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Status</label>
                                <select
                                  value={campaign.status}
                                  onChange={(e) => updateCampaign(po.id, campaign.id, 'status', e.target.value)}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        ))}

                        {po.campaigns.length === 0 && (
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
