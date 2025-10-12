import { useState, useEffect } from 'react';
import { Plus, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

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

  // Sign in only (no sign up)
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

  // Sign in screen (NO SIGN UP OPTION)
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Sign In</h1>
          <p className="text-sm text-gray-600 mb-6">Contact your administrator for account access</p>
          
          <form onSubmit={handleSignIn} className="space-y-4">
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
              Sign In
            </button>
          </form>
          
          <p className="mt-6 text-xs text-gray-500 text-center">
            Need an account? Contact admin@omc.com
          </p>
        </div>
      </div>
    );
  }

  // Main app (same as before - I'll include the complete tracker UI)
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Full tracker UI - same as your current version */}
      {/* ... rest of tracker code ... */}
    </div>
  );
}
