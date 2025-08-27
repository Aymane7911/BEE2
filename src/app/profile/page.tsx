'use client';

import React, { useState, useRef, useEffect} from 'react';
import { useSession } from 'next-auth/react';
import Web3 from 'web3';
import { contractABI, contractAddress } from '../../contractsinfo';
import { Session } from 'next-auth';
import { 
  User, 
  Camera, 
  MapPin, 
  Edit3, 
  Save, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  Shield,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  X,
  Home,
  Layers,
  Activity,
  Wallet,
  Users,
  Settings,
  HelpCircle,
  Menu,
  Map,
  Package,
  Calendar,
  BarChart3,
  Sparkles,
  RefreshCw,
  Printer,
  ExternalLink // Added ExternalLink icon
} from 'lucide-react';


// Header component
interface HeaderProps {
  toggleSidebar: () => void;
  refreshData: () => void;
  handleDelete: () => void;
  handlePrint: () => void;
  selectedBatches: string[];
  lastUpdated: string;
}

const Header: React.FC<HeaderProps> = ({
  toggleSidebar,
  refreshData,
  handleDelete,
  handlePrint,
  selectedBatches,
  lastUpdated
}) => {
  return (
    <header className="bg-white/80 backdrop-blur-xl p-4 rounded-3xl shadow-lg border border-white/20 text-black mb-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <button 
            onClick={toggleSidebar}
            className="mr-4 p-2 rounded-xl hover:bg-yellow-100/50 transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center">
            <div className="mr-3 bg-gradient-to-br from-yellow-500 to-amber-500 p-2 rounded-xl shadow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM6 14C5.45 14 5 13.55 5 13C5 12.45 5.45 12 6 12C6.55 12 7 12.45 7 13C7 13.55 6.55 14 6 14ZM9 9C8.45 9 8 8.55 8 8C8 7.45 8.45 7 9 7C9.55 7 10 7.45 10 8C10 8.55 9.55 9 9 9ZM15 9C14.45 9 14 8.55 14 8C14 7.45 14.45 7 15 7C15.55 7 16 7.45 16 8C16 8.55 15.55 9 15 9ZM18 14C17.45 14 17 13.55 17 13C17 12.45 17.45 12 18 12C18.55 12 19 12.45 19 13C19 13.55 18.55 14 18 14Z" fill="white"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">HoneyCertify</h1>
              <p className="text-xs text-gray-500">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={refreshData}
            className="group relative overflow-hidden p-2 
                       bg-gradient-to-r from-blue-600 to-indigo-500 
                       text-white rounded-lg shadow-lg
                       transform transition-all duration-300 
                       hover:from-blue-500 hover:to-indigo-400"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          
          <button
            onClick={handlePrint}
            className={`group relative overflow-hidden p-2 rounded-lg font-semibold shadow-lg
                       transform transition-all duration-300
                       bg-gradient-to-r from-emerald-600 to-green-500 text-white`}
          >
            <Printer className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

// 5. Update Apiary interface to match Prisma:
interface Apiary {
  id: number;
  name: string;
  number: string;
  hiveCount: number;
  latitude: number;
  longitude: number;
  kilosCollected: number;
  batchId: string;
}

interface Batch {
  id: string;
  batchNumber: string;
  batchName: string; // Changed from 'name' to 'batchName'
  status: string;
  containerType: string;
  labelType: string;
  weightKg: number; // Changed from 'totalKg' to 'weightKg'
  jarsUsed: number; // Changed from 'jarsProduced' to 'jarsUsed'
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  uncertified: number;
  completedChecks: number;
  totalChecks: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  apiaries: Apiary[];
}

interface UserProfile {
  id?: number;
  firstname: string;
  lastname: string;
  email: string;
  phonenumber: string;
  address?: string;
  passportId?: string;
  profileImage: string | null;
  passportScan: string | null;
  faceScan: string | null;
  isConfirmed: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  faceVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Add index signature to allow string keys
  [key: string]: any;
  // Computed properties for convenience
  verificationStatus: {
    email: boolean;
    phone: boolean;
    identity: boolean;
    face: boolean;
    // Add index signature for verificationStatus too
    [key: string]: boolean;
  };
  // Computed full name
  get fullName(): string;
}

const ProfilePage = () => {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleString());

  // JWT Token Management
  const getJWTToken = (): string | null => {
    // Check localStorage first, then sessionStorage
    return localStorage.getItem('authToken') || 
           localStorage.getItem('token') || 
           sessionStorage.getItem('authToken') || 
           sessionStorage.getItem('token') || 
           null;
  };

  // Add these to your existing state declarations
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [apiariesLoading, setApiariesLoading] = useState(true);
  const [editingApiary, setEditingApiary] = useState<number | null>(null);
  const [newApiary, setNewApiary] = useState({
    name: '',
    number: '',
    hiveCount: 0,
    latitude: 0,
    longitude: 0,
    locationName: '',
    kilosCollected: 0
  });
  const [showAddApiary, setShowAddApiary] = useState(false);
   const web3 = new Web3("http://127.0.0.1:8545");
   const contract = new web3.eth.Contract(contractABI,process.env.NEXT_PUBLIC_HARDHAT_ACCOUNT);

  // Add these API functions
  const fetchApiaries = async () => {
    try {
      console.log('Fetching apiaries with JWT token...');
      const response = await makeAuthenticatedRequest('/api/apiaries');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Apiaries fetched successfully:', data.length || 0, 'apiaries');
        return data || [];
      } else {
        console.error('Failed to fetch apiaries:', response.status);
        return [];
      }
    } catch (error) {
      console.error('Error fetching apiaries:', error);
      return [];
    }
  };

 const updateApiary = async (id: number, apiaryData: any) => {
  try {
    console.log('updateApiary called with:', { id, apiaryData });
         
    // Clean the data before sending - remove fields that shouldn't be sent
    const cleanApiaryData = {
      name: apiaryData.name,
      number: apiaryData.number,
      hiveCount: apiaryData.hiveCount,
      latitude: apiaryData.latitude,
      longitude: apiaryData.longitude,
      kilosCollected: apiaryData.kilosCollected,
      locationName: apiaryData.locationName || ''
    };
         
    console.log('Sending cleaned data:', cleanApiaryData);
         
    const response = await makeAuthenticatedRequest(`/api/apiaries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cleanApiaryData),
    });
         
    console.log('Response status:', response.status);
         
    if (response.ok) {
      const updatedApiary = await response.json();
      console.log('Updated apiary from server:', updatedApiary);
      
      // DON'T update local state - let the component refresh from server
      setEditingApiary(null);
      console.log('Update successful');
      return true;
    } else {
      const errorText = await response.text();
      console.error('Failed to update apiary:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('Error updating apiary:', error);
    return false;
  }
};

  const createApiary = async (apiaryData: any) => {
    try {
      const response = await makeAuthenticatedRequest('/api/apiaries', {
        method: 'POST',
        body: JSON.stringify(apiaryData),
      });
      
      if (response.ok) {
        const newApiaryData = await response.json();
        setApiaries(prev => [newApiaryData, ...prev]);
        setNewApiary({
          name: '',
          number: '',
          hiveCount: 0,
          latitude: 0,
          longitude: 0,
          locationName: '',
          kilosCollected: 0
        });
        setShowAddApiary(false);
        return true;
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to create apiary');
        return false;
      }
    } catch (error) {
      console.error('Error creating apiary:', error);
      alert('Error creating apiary');
      return false;
    }
  };

  const deleteApiary = async (id: number) => {
    if (!confirm('Are you sure you want to delete this apiary? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await makeAuthenticatedRequest(`/api/apiaries/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setApiaries(prev => prev.filter(apiary => apiary.id !== id));
      } else {
        alert('Failed to delete apiary');
      }
    } catch (error) {
      console.error('Error deleting apiary:', error);
      alert('Error deleting apiary');
    }
  };

  // Add this useEffect to fetch apiaries
  useEffect(() => {
    if (!isAuthenticated || !authToken) {
      setApiariesLoading(false);
      return;
    }

    const loadApiaries = async () => {
      setApiariesLoading(true);
      const apiaryData = await fetchApiaries();
      setApiaries(apiaryData);
      setApiariesLoading(false);
    };

    loadApiaries();
  }, [isAuthenticated, authToken]);

  // Update your refreshData function to include apiaries
  const refreshData = async () => {
    setBatchesLoading(true);
    setApiariesLoading(true);
    try {
      const userData = await fetchUserProfile();
      if (userData) {
        setUserProfile(prev => ({
          ...prev,
          firstname: userData.firstname || '',
          lastname: userData.lastname || '',
          email: userData.email || '',
          phonenumber: userData.phonenumber || '',
          passportId: userData.passportId || '',
          profileImage: userData.profileImage || null,
          passportScan: userData.passportScan || null,
          faceScan: userData.faceScan || null,
          verificationStatus: {
            email: userData.isConfirmed || false,
            phone: userData.phoneConfirmed || false,
            identity: userData.identityVerified || false,
            face: userData.faceVerified || false
          }
        }));
      }

      const [batchData, apiaryData] = await Promise.all([
        fetchBatches(),
        fetchApiaries()
      ]);
      
      setBatches(batchData);
      setApiaries(apiaryData);
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setBatchesLoading(false);
      setApiariesLoading(false);
    }
  };

  const clearJWTToken = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    setAuthToken(null);
    setIsAuthenticated(false);
  };

  // API call functions with proper JWT handling
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const token = authToken || getJWTToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    // Handle token expiration
    if (response.status === 401) {
      console.warn('Token expired or invalid, clearing auth state');
      clearJWTToken();
      // Redirect to login or show login modal
      window.location.href = '/login';
      throw new Error('Authentication token expired');
    }

    return response;
  };

  const fetchBatches = async () => {
    try {
      console.log('Fetching batches with JWT token...');
      const response = await makeAuthenticatedRequest('/api/batches');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Batches fetched successfully:', data.batches?.length || 0, 'batches');
        return data.batches || [];
      } else {
        console.error('Failed to fetch batches:', response.status);
        return [];
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      return [];
    }
  };

  const fetchUserProfile = async () => {
    try {
      console.log('Fetching user profile with JWT token...');
      const response = await makeAuthenticatedRequest('/api/user/profile');
      
      if (response.ok) {
        const userData = await response.json();
        console.log('Profile data fetched successfully');
        return userData;
      } else {
        console.error('Failed to fetch user profile:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };
  
  
   


  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = () => {
      const token = getJWTToken();
      console.log('Initializing auth state, token found:', !!token);
      
      if (token) {
        setAuthToken(token);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        // Redirect to login if no token
        console.warn('No auth token found, redirecting to login');
        window.location.href = '/login';
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const formFields = [
  { key: 'firstname', label: 'First Name', type: 'text' },
  { key: 'lastname', label: 'Last Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email', readOnly: true },
  { key: 'phonenumber', label: 'Phone Number', type: 'tel' },
  { key: 'passportId', label: 'Passport ID', type: 'text', readOnly: true } // Add readOnly: true
];
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editMode, setEditMode] = useState({
    personal: false,
    apiaries: false
  });
  const [activeTab, setActiveTab] = useState('overview');

  // User profile state
  const [userProfile, setUserProfile] = useState<UserProfile>({
  firstname: '',
  lastname: '',
  email: '',
  phonenumber: '',
  passportId: '', // Add this line
  profileImage: null,
  passportScan: null,
  faceScan: null,
  isConfirmed: true,
  phoneVerified: true,
  identityVerified: false,
  faceVerified: false,
  verificationStatus: {
    email: true,
    phone: true,
    identity: false,
    face: false
  },
  get fullName() {
    return `${this.firstname} ${this.lastname}`.trim();
  }
});

  // Batches state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);

  // Fetch user profile
  useEffect(() => {
    if (!isAuthenticated || !authToken) return;

    const loadUserProfile = async () => {
  const userData = await fetchUserProfile();
  if (userData) {
    setUserProfile(prev => ({
  ...prev,
  firstname: userData.firstname || '',
  lastname: userData.lastname || '',
  email: userData.email || '',
  phonenumber: userData.phonenumber || '',
  passportId: userData.passportId || '',
  profileImage: userData.profileImage || null,
  passportScan: userData.passportScan || null,
  faceScan: userData.faceScan || null,
  verificationStatus: {
    email: userData.isConfirmed || false,
    phone: userData.phoneConfirmed || false,
    identity: !!(userData.passportId || userData.identityVerified), // Check if passportId exists OR identityVerified
    face: userData.faceVerified || false
  }
}));
  }
};

    loadUserProfile();
  }, [isAuthenticated, authToken]);

  // Fetch batches
  useEffect(() => {
    if (!isAuthenticated || !authToken) {
      setBatchesLoading(false);
      return;
    }

    const loadBatches = async () => {
      setBatchesLoading(true);
      const batchData = await fetchBatches();
      setBatches(batchData);
      setBatchesLoading(false);
      setLastUpdated(new Date().toLocaleString());
    };

    loadBatches();
  }, [isAuthenticated, authToken]);

  // File upload refs
  const profileImageRef = useRef<HTMLInputElement>(null);
  const passportScanRef = useRef<HTMLInputElement>(null);
  const faceScanRef = useRef<HTMLInputElement>(null);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
const handleFileUpload = async (type: string, file: File | null) => {
  console.log('🔄 handleFileUpload called with:', { type, file: file?.name });
  
  if (file) {
    console.log('📁 File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    
    try {
      // Fetch user profile to get adminId
      console.log('👤 Fetching user profile to get adminId...');
      const userData = await fetchUserProfile();
      
      if (!userData) {
        console.error('❌ Failed to fetch user profile, cannot get adminId');
        throw new Error('Unable to fetch user profile');
      }
      
      console.log('✅ User profile fetched:', userData);
      
     
      
      // Continue with file upload processing
      const reader = new FileReader();
      
      reader.onload = (e) => {
        console.log('📖 File reader onload triggered');
        if (e.target?.result) {
          console.log('📄 File read successfully, updating user profile...');
          console.log('🔧 Updating profile field:', type);
          
          setUserProfile(prev => ({
            ...prev,
            [type]: e.target!.result
          }));
          
          console.log('✅ User profile updated for field:', type);
                   
          // Update verification status
          if (type === 'passportScan' || type === 'faceScan') {
            const verificationField = type === 'passportScan' ? 'identity' : 'face';
            console.log('🔐 Updating verification status for:', verificationField);
            
            setUserProfile(prev => ({
              ...prev,
              verificationStatus: {
                ...prev.verificationStatus,
                [verificationField]: true
              }
            }));
            
            console.log('✅ Verification status updated for:', verificationField);
          }
        } else {
          console.log('❌ File reader result is empty');
        }
      };
      
      reader.onerror = (error) => {
        console.error('❌ File reader error:', error);
      };
      
      reader.readAsDataURL(file);
      console.log('📖 File reader started...');
      
    } catch (error) {
    const err = error as Error;
    console.error('❌ Error in refreshData:');
    console.error('📋 Error type:', err?.constructor?.name);
    console.error('📋 Error message:', err.message);
    console.error('📋 Full error object:', err);
    console.error('📋 Stack trace:', err.stack);
      
      if (error && typeof error === 'object' && 'code' in error) {
  console.error('📋 Error code:', (error as any).code);
}
      
      console.log('🔄 Continuing with file upload despite getbatch error...');
      
      // Continue with file upload despite getbatch error
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('📖 File reader onload (error recovery)');
        if (e.target?.result) {
          console.log('📄 File read successfully (error recovery)');
          setUserProfile(prev => ({
            ...prev,
            [type]: e.target!.result
          }));
                   
          if (type === 'passportScan' || type === 'faceScan') {
            const verificationField = type === 'passportScan' ? 'identity' : 'face';
            console.log('🔐 Updating verification status (error recovery):', verificationField);
            setUserProfile(prev => ({
              ...prev,
              verificationStatus: {
                ...prev.verificationStatus,
                [verificationField]: true
              }
            }));
          }
          console.log('✅ File upload completed despite getbatch error');
        }
      };
      
      reader.onerror = (readerError) => {
        console.error('❌ File reader error (error recovery):', readerError);
      };
      
      reader.readAsDataURL(file);
    }
  } else {
    console.log('⚠️ No file provided to handleFileUpload');
  }
  
  console.log('🏁 handleFileUpload function completed');
};



  const getVerificationColor = (status: boolean) => {
    return status ? 'text-green-600' : 'text-orange-500';
  };

  const getVerificationIcon = (status: boolean) => {
    return status ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />;
  };

  // Calculate statistics
  const totalApiaries = batches.reduce((total, batch) => total + (batch.apiaries?.length || 0), 0);
  const activeBatches = batches.filter(batch => batch.status === 'active' || batch.status === 'completed').length;
  const totalHives = batches.reduce((total, batch) => 
    total + (batch.apiaries?.reduce((hiveTotal, apiary) => hiveTotal + apiary.hiveCount, 0) || 0), 0
  );
  const totalHoneyCollected = batches.reduce((total, batch) => total + (batch.weightKg || 0), 0);

  // Header functions
  const handleDelete = () => {
    alert('Delete functionality is not available on the profile page.');
  };

  const handlePrint = () => {
    alert('Print functionality is not available on the profile page.');
  };

  return (
    <div className="flex flex-col space-y-6 p-6 min-h-screen bg-gradient-to-b from-yellow-200 to-white text-black">
      {/* Sidebar */}
      {/* Enhanced Sidebar */}
      <div className={`fixed top-0 left-0 h-full bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white transition-all duration-500 ease-in-out z-20 ${sidebarOpen ? 'w-72' : 'w-0'} overflow-hidden shadow-2xl`}>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-purple-900/20"></div>
        <div className="relative z-10">
          <div className="p-6 flex justify-between items-center border-b border-gray-700/50">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">Navigation</h2>
            <button onClick={toggleSidebar} className="p-2 hover:bg-gray-700/50 rounded-xl transition-all duration-300">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="mt-8 px-4">
            <ul className="space-y-3">
              {[
                { icon: Home, label: 'Dashboard', href: '/dashboard' },
                { icon: Layers, label: 'Batches', href: '/batches' },
                { icon: Activity, label: 'Analytics', href: '/analytics' },
                { icon: Users, label: 'Profile', href: '/profile' },
                { icon: HelpCircle, label: 'Help', href: '#' }
              ].map((item, index) => (
                <li key={index}>
                  <a href={item.href} className="group flex items-center px-4 py-4 rounded-xl hover:bg-gradient-to-r hover:from-yellow-500/20 hover:to-amber-500/20 transition-all duration-300 transform hover:translate-x-2">
                    <item.icon className="h-6 w-6 mr-4 transition-all duration-300 group-hover:text-yellow-400 group-hover:scale-110" />
                    <span className="font-medium group-hover:text-yellow-300 transition-colors duration-300">{item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Enhanced Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 backdrop-blur-md bg-black/30 z-10 transition-all duration-500"
          onClick={toggleSidebar}
        ></div>
      )}
      
      {/* Main Content */}
      <div className="p-6">
        {/* New Header */}
        <Header
          toggleSidebar={toggleSidebar}
          refreshData={refreshData}
          handleDelete={handleDelete}
          handlePrint={handlePrint}
          selectedBatches={[]}
          lastUpdated={lastUpdated}
        />

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Batches</p>
                <p className="text-3xl font-bold text-gray-900">{batches.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <Layers className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Batches</p>
                <p className="text-3xl font-bold text-green-600">{activeBatches}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Apiaries</p>
                <p className="text-3xl font-bold text-amber-600">{totalApiaries}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-xl">
                <Map className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hives</p>
                <p className="text-3xl font-bold text-orange-600">{totalHives}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-xl">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg mb-8 border border-white/20">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-medium transition-colors ${activeTab === 'overview' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Profile Overview
            </button>
            <button
              onClick={() => setActiveTab('batches')}
              className={`px-6 py-4 font-medium transition-colors ${activeTab === 'batches' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
              My Batches
            </button>
            <button
              onClick={() => setActiveTab('verification')}
              className={`px-6 py-4 font-medium transition-colors ${activeTab === 'verification' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Verification
            </button>
            <button
              onClick={() => setActiveTab('apiaries')}
              className={`px-6 py-4 font-medium transition-colors ${activeTab === 'apiaries' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
              My Apiaries
            </button>
          </div>

          <div className="p-6">
            {/* Profile Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="lg:col-span-1">
                  <div className="text-center">
                    <div className="relative inline-block mb-6">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 flex items-center justify-center overflow-hidden shadow-lg">
                        {userProfile.profileImage ? (
                          <img src={userProfile.profileImage} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-16 w-16 text-white" />
                        )}
                      </div>
                      <button
                        onClick={() => profileImageRef.current?.click()}
                        className="absolute bottom-0 right-0 bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-full shadow-lg transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                      <input
                        ref={profileImageRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload('profileImage', e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
  {userProfile.firstname} {userProfile.lastname}
</h2>
                    <p className="text-gray-600 mb-6">{userProfile.email}</p>
                    
                    {/* Verification Status */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">Verification Status</h3>
                      <div className="space-y-3">
                        {[
                          { key: 'email', label: 'Email' },
                          { key: 'phone', label: 'Phone' },
                          { key: 'identity', label: 'Identity' },
                          { key: 'face', label: 'Face Scan' }
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{label}</span>
                            <div className={`flex items-center ${getVerificationColor(userProfile.verificationStatus[key])}`}>
                              {getVerificationIcon(userProfile.verificationStatus[key])}
                              <span className="ml-2 text-xs font-medium">
                                {userProfile.verificationStatus[key] ? 'Verified' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="lg:col-span-2">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-800">Personal Information</h3>
                    <button
                      onClick={() => setEditMode(prev => ({ ...prev, personal: !prev.personal }))}
                      className="flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                    >
                      {editMode.personal ? <Save className="h-4 w-4 mr-2" /> : <Edit3 className="h-4 w-4 mr-2" />}
                      {editMode.personal ? 'Save' : 'Edit'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {formFields.map(({ key, label, type, readOnly }) => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {editMode.personal ? (
        <input
          type={type}
          value={userProfile[key] || ''}
          onChange={(e) => setUserProfile(prev => ({ ...prev, [key]: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
          placeholder={ key === 'passportId' ? `Enter ${label.toLowerCase()}` : ''}
          readOnly={readOnly}
        />
      ) : (
        <p className="py-2 text-gray-800">{userProfile[key] || 'Not provided'}</p>
      )}
    </div>
  ))}
                      
                  </div>
                </div>
              </div>
            )}

            {/* My Batches Tab */}
           {activeTab === 'batches' && (
      <div>
           <div className="flex justify-between items-center mb-6">
           <h3 className="text-xl font-semibold text-gray-800">My Honey Batches</h3>
           <div className="text-sm text-gray-600">
               {batches.length} total batches • {activeBatches} active
          </div>
        </div>
                
                {batchesLoading ? (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading batches...</p>
      </div>
    ) : batches.length > 0 ? (
                  <div className="space-y-6">
                    {batches.map((batch) => (
  <div key={batch.id} className="bg-gradient-to-r from-white to-amber-50 border border-amber-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h4 className="text-xl font-bold text-gray-800 mb-1">{batch.batchName}</h4> {/* Changed from batch.batchName */}
        <p className="text-gray-600 mb-2">Batch Number: <span className="font-medium">{batch.batchNumber}</span></p>
        <div className="flex items-center space-x-4">
          <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${batch.status === 'completed' ? 'bg-green-100 text-green-800' : batch.status === 'active' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
            {batch.status === 'completed' ? 'Completed' : batch.status === 'active' ? 'Active' : 'Pending'}
          </span>
          <span className="flex items-center text-sm text-gray-500">
            <Calendar className="h-4 w-4 mr-1" />
            {new Date(batch.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
                        
                        {/* Batch Statistics - Updated to match your data structure */}
    <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-white/60 rounded-lg">
    <div className="text-center">
      <p className="text-2xl font-bold text-amber-600">{batch.apiaries?.length || 0}</p>
      <p className="text-sm text-gray-600">Apiaries</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold text-green-600">
        {batch.apiaries?.reduce((total, apiary) => total + apiary.hiveCount, 0) || 0}
      </p>
      <p className="text-sm text-gray-600">Total Hives</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold text-orange-600">
        {batch.weightKg ? batch.weightKg.toLocaleString() : '0'} kg {/* Changed from totalKg */}
      </p>
      <p className="text-sm text-gray-600">Total Weight</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold text-blue-600">
        {batch.jarsUsed ? batch.jarsUsed.toLocaleString() : '0'} {/* Changed from jarsProduced */}
      </p>
      <p className="text-sm text-gray-600">Jars Used</p>
    </div>
  </div>
                        
                        {/* Associated Apiaries */}
                        <div>
                          <h5 className="font-semibold text-gray-700 mb-4 flex items-center">
                            <MapPin className="h-4 w-4 mr-2" />
                            Associated Apiaries
                          </h5>
                          {batch.apiaries && batch.apiaries.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {batch.apiaries.map((apiary) => (
                                <div key={apiary.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:border-amber-300 transition-colors">
                                  <div className="flex justify-between items-start mb-2">
                                    <h6 className="font-semibold text-gray-800">{apiary.name}</h6>
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded"># {apiary.number}</span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2 flex items-center">
    <MapPin className="h-3 w-3 mr-1" />
    Lat: {apiary.latitude.toFixed(4)}, Lng: {apiary.longitude.toFixed(4)}
  </p>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-gray-500">Hives:</span>
                                      <span className="font-medium text-green-600 ml-1">{apiary.hiveCount}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Honey:</span>
                                      <span className="font-medium text-orange-600 ml-1">{apiary.kilosCollected} kg</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-lg">
                              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-500">No apiaries associated with this batch</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-xl text-gray-600 mb-2">No batches created yet</p>
                    <p className="text-gray-500 mb-6">Create your first honey batch from the dashboard to start tracking your production</p>
                    <a 
                      href="/dashboard" 
                      className="inline-flex items-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Batch
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Verification Tab */}
            {activeTab === 'verification' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-6">Identity Verification Documents</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Passport Scan */}
                  <div className="border-2 border-dashed border-amber-300 rounded-xl p-8 text-center hover:border-amber-400 transition-colors bg-amber-50/50">
  <div className="mb-6">
    {userProfile.passportScan ? ( // Changed from !userProfile.passportScan to userProfile.passportScan
      <div className="relative">
        <img src={userProfile.passportScan} alt="Passport" className="w-full h-40 object-cover rounded-lg shadow-md" />
        <div className="absolute top-2 right-2 bg-green-500 text-white p-2 rounded-full shadow-lg">
          <CheckCircle className="h-4 w-4" />
        </div>
      </div>
    ) : (
      <div className="w-full h-40 bg-white/80 rounded-lg flex items-center justify-center shadow-inner">
        <FileText className="h-16 w-16 text-amber-400" />
      </div>
    )}
  </div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Passport Document</h4>
                    <p className="text-sm text-gray-600 mb-6">Upload a clear photo of your passport for identity verification</p>
                    <button
                      onClick={() => passportScanRef.current?.click()}
                      className="flex items-center justify-center w-full px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {userProfile.passportScan ? 'Replace Document' : 'Upload Passport'}
                    </button>
                    <input
                      ref={passportScanRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload('passportScan', e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Verification Progress */}
                <div className="mt-8 p-6 bg-white/80 rounded-xl border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Verification Progress</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { key: 'email', label: 'Email Verification', icon: CheckCircle },
                      { key: 'phone', label: 'Phone Verification', icon: CheckCircle },
                      { key: 'identity', label: 'Identity Document', icon: userProfile.verificationStatus.identity ? CheckCircle : AlertCircle },
                    ].map(({ key, label, icon: Icon }) => (
                      <div key={key} className="text-center">
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${userProfile.verificationStatus[key] ? 'bg-green-100' : 'bg-orange-100'}`}>
                          <Icon className={`h-6 w-6 ${userProfile.verificationStatus[key] ? 'text-green-600' : 'text-orange-500'}`} />
                        </div>
                        <p className="text-sm font-medium text-gray-700">{label}</p>
                        <p className={`text-xs mt-1 ${userProfile.verificationStatus[key] ? 'text-green-600' : 'text-orange-500'}`}>
                          {userProfile.verificationStatus[key] ? 'Completed' : 'Pending'}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Overall Progress */}
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                      <span className="text-sm text-gray-600">
                        {Object.values(userProfile.verificationStatus).filter(Boolean).length}/3 Complete
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-amber-500 to-yellow-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(Object.values(userProfile.verificationStatus).filter(Boolean).length / 3) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                      <Shield className="h-5 w-5 text-blue-600 mt-1 mr-3 flex-shrink-0" />
                      <div>
                        <h5 className="font-medium text-blue-900 mb-1">Security & Privacy</h5>
                        <p className="text-sm text-blue-700">
                          Your verification documents are encrypted and stored securely. We use industry-standard 
                          security measures to protect your personal information and comply with data protection regulations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* My Apiaries Tab */}
            {activeTab === 'apiaries' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">My Apiaries</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage your apiary locations and production data
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddApiary(true)}
                    className="flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Apiary
                  </button>
                </div>

                {/* Add New Apiary Form */}
                {showAddApiary && (
                  <div className="mb-8 p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold text-gray-800">Add New Apiary</h4>
                      <button
                        onClick={() => setShowAddApiary(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Apiary Name</label>
                        <input
                          type="text"
                          value={newApiary.name}
                          onChange={(e) => setNewApiary(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Enter apiary name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Apiary Number</label>
                        <input
                          type="text"
                          value={newApiary.number}
                          onChange={(e) => setNewApiary(prev => ({ ...prev, number: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Enter apiary number"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Hive Count</label>
                        <input
                          type="number"
                          value={newApiary.hiveCount}
                          onChange={(e) => setNewApiary(prev => ({ ...prev, hiveCount: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Number of hives"
                          min="0"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={newApiary.latitude}
                          onChange={(e) => setNewApiary(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Latitude coordinates"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={newApiary.longitude}
                          onChange={(e) => setNewApiary(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Longitude coordinates"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Honey Collected (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newApiary.kilosCollected}
                          onChange={(e) => setNewApiary(prev => ({ ...prev, kilosCollected: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Kilograms collected"
                          min="0"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Location Name (Optional)</label>
                        <input
                          type="text"
                          value={newApiary.locationName}
                          onChange={(e) => setNewApiary(prev => ({ ...prev, locationName: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="e.g., North Field, Mountain Ridge"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => setShowAddApiary(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => createApiary(newApiary)}
                        className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                      >
                        Create Apiary
                      </button>
                    </div>
                  </div>
                )}

                {/* Apiaries List */}
                {apiariesLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading apiaries...</p>
                  </div>
                ) : apiaries.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {apiaries.map((apiary) => (
      <div 
        key={`apiary-${apiary.id}`} // More explicit key
        className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300"
      >
        {editingApiary === apiary.id ? (
  <div className="space-y-4">
    {/* Editing form content */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
      <input
        type="text"
        value={apiary.name} // Changed from defaultValue to value
        onChange={(e) => setApiaries(prev => prev.map(a => 
          a.id === apiary.id ? { ...a, name: e.target.value } : a
        ))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
      <input
        type="text"
        value={apiary.number} // Changed from defaultValue to value
        onChange={(e) => setApiaries(prev => prev.map(a => 
          a.id === apiary.id ? { ...a, number: e.target.value } : a
        ))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Hive Count</label>
      <input
        type="number"
        value={apiary.hiveCount} // Changed from defaultValue to value
        onChange={(e) => setApiaries(prev => prev.map(a => 
          a.id === apiary.id ? { ...a, hiveCount: parseInt(e.target.value) || 0 } : a
        ))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
        min="0"
      />
    </div>
    
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
        <input
          type="number"
          step="0.000001"
          value={apiary.latitude} // Changed from defaultValue to value
          onChange={(e) => setApiaries(prev => prev.map(a => 
            a.id === apiary.id ? { ...a, latitude: parseFloat(e.target.value) || 0 } : a
          ))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
        <input
          type="number"
          step="0.000001"
          value={apiary.longitude} // Changed from defaultValue to value
          onChange={(e) => setApiaries(prev => prev.map(a => 
            a.id === apiary.id ? { ...a, longitude: parseFloat(e.target.value) || 0 } : a
          ))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Honey Collected (kg)</label>
      <input
        type="number"
        step="0.1"
        value={apiary.kilosCollected} // Changed from defaultValue to value
        onChange={(e) => setApiaries(prev => prev.map(a => 
          a.id === apiary.id ? { ...a, kilosCollected: parseFloat(e.target.value) || 0 } : a
        ))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
        min="0"
      />
    </div>
    
    <div className="flex justify-end space-x-2 pt-4 border-t">
      <button
        onClick={() => {
          setEditingApiary(null);
          // Optional: Refresh data from server to revert any unsaved changes
          // fetchApiaries();
        }}
        className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        Cancel
      </button>
     <button
  onClick={async () => {
    const currentApiary = apiaries.find(a => a.id === apiary.id);
    if (currentApiary) {
      const success = await updateApiary(apiary.id, currentApiary);
      if (success) {
        // Refresh the apiaries data from server
        await fetchApiaries(); // This should be your function that fetches all apiaries
      } else {
        alert('Failed to update apiary. Please try again.');
      }
    }
  }}
  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center"
>
  <Save className="h-4 w-4 mr-1" />
  Save
</button>
    </div>
  </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="text-lg font-semibold text-gray-800">{apiary.name}</h4>
                                <p className="text-sm text-gray-600">#{apiary.number}</p>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setEditingApiary(apiary.id)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteApiary(apiary.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="flex items-center text-sm text-gray-600">
                                 <MapPin className="h-4 w-4 mr-2 text-amber-500" />
  <span>
    {typeof apiary.latitude === 'number' ? apiary.latitude.toFixed(4) : '0.0000'}, {typeof apiary.longitude === 'number' ? apiary.longitude.toFixed(4) : '0.0000'}
  </span>
  <a
    href={`https://www.google.com/maps?q=${apiary.latitude || 0},${apiary.longitude || 0}`}
    target="_blank"
    rel="noopener noreferrer"
    className="ml-2 text-blue-600 hover:text-blue-800"
  >
    <ExternalLink className="h-3 w-3" />
  </a>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                  <p className="text-lg font-bold text-green-600">{apiary.hiveCount}</p>
                                  <p className="text-xs text-gray-600">Hives</p>
                                </div>
                                <div className="text-center p-3 bg-orange-50 rounded-lg">
                                  <p className="text-lg font-bold text-orange-600">{apiary.kilosCollected} kg</p>
                                  <p className="text-xs text-gray-600">Honey</p>
                                </div>
                              </div>
                              
                              {apiary.hiveCount > 0 && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                  <p className="text-sm text-gray-600">
                                    Avg per hive: <span className="font-semibold text-amber-600">
                                      {(apiary.kilosCollected / apiary.hiveCount).toFixed(1)} kg
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Map className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-xl text-gray-600 mb-2">No apiaries registered yet</p>
                    <p className="text-gray-500 mb-6">Add your first apiary to start tracking your honey production</p>
                    <button
                      onClick={() => setShowAddApiary(true)}
                      className="inline-flex items-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Apiary
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Additional Statistics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Production Summary */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20">
            <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-amber-600" />
              Production Summary
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Total Honey Collected</p>
                  <p className="text-2xl font-bold text-amber-600">{totalHoneyCollected} kg</p>
                </div>
                <div className="text-amber-600">
                  <Package className="h-8 w-8" />
                </div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Average per Hive</p>
                  <p className="text-2xl font-bold text-green-600">
                    {totalHives > 0 ? (totalHoneyCollected / totalHives).toFixed(1) : '0'} kg
                  </p>
                </div>
                <div className="text-green-600">
                  <Activity className="h-8 w-8" />
                </div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Active Locations</p>
                  <p className="text-2xl font-bold text-blue-600">{totalApiaries}</p>
                </div>
                <div className="text-blue-600">
                  <Map className="h-8 w-8" />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20">
            <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-green-600" />
              Recent Activity
            </h3>
            <div className="space-y-4">
  {batches.length > 0 ? (
    batches.slice(0, 5).map((batch, index) => (
      <div key={batch.id} className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full flex items-center justify-center mr-4">
          <Package className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            Created batch: {batch.batchName}
          </p>
          <p className="text-xs text-gray-500">
            {new Date(batch.createdAt).toLocaleDateString()} • {batch.apiaries?.length || 0} apiaries
          </p>
        </div>
        <div className={`px-2 py-1 text-xs rounded-full ${batch.status === 'completed' ? 'bg-green-100 text-green-800' : batch.status === 'active' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
          {batch.status === 'completed' ? 'Completed' : batch.status === 'active' ? 'Active' : 'Pending'}
        </div>
      </div>
    ))
  ) : (
    <div className="text-center py-8">
      <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
      <p className="text-gray-500">No recent activity</p>
      <p className="text-sm text-gray-400">Your batch activities will appear here</p>
    </div>
  )}
</div>
          </div>
        </div>

        
      </div>
    </div>
  );
};

export default ProfilePage;