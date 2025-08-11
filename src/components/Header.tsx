import { useState, useEffect, useRef } from 'react';
import { Layers, Database, Tag, Package, RefreshCw, Menu, X, Home, Settings, Users, Activity, HelpCircle, Wallet, PlusCircle, MapPin, CheckCircle, Trash2, Globe, FileText, AlertCircle, Sparkles, LogOut, Plus, Star, LayoutDashboard } from 'lucide-react';

// Mock interfaces for demo
interface Batch {
  id: string;
  batchNumber: string;
  batchName: string;
  name: string;
  createdAt: string;
  status: string;
  totalKg: number;
  jarsProduced: number;
  apiaries: any[];
  certificationStatus: any;
  containerType: string;
  labelType: string;
  weightKg: number;
  jarUsed: number;
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  uncertified: number;
  completedChecks: number;
  totalChecks: number;
  certificationDate?: string;
  expiryDate?: string;
  productionReportPath?: string;
  labReportPath?: string;
  jarCertifications?: any;
  honeyCertified?: number;
  honeyRemaining?: number;
  totalHoneyCollected?: number;
  userId: number;
}

interface TokenStats {
  id?: number;
  userId?: number;
  totalTokens: number;
  remainingTokens: number;
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  usedTokens: number;
}

interface HeaderProps {
  toggleSidebar: () => void;
  tokenBalance: number;
  router: any;
  setShowBatchModal: (show: boolean) => void;
  handleLogout: () => void;
  isLoggingOut: boolean;
  lastUpdated: string;
  batches?: Batch[];
  tokenStats?: TokenStats;
}

const getTokenFromStorage = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authtoken') ||
           localStorage.getItem('auth_token') ||
           localStorage.getItem('token') ||
           sessionStorage.getItem('authtoken') ||
           sessionStorage.getItem('auth_token') ||
           sessionStorage.getItem('token');
  }
  return null;
};

const Header = ({ 
  toggleSidebar = () => {},
  tokenBalance = 400,
  router = { push: (path: string) => console.log(`Navigate to: ${path}`) },
  setShowBatchModal = () => {},
  handleLogout = () => {},
  isLoggingOut = false,
  lastUpdated = "8/11/2025, 8:38:14 AM",
  batches = [],
  tokenStats: initialTokenStats
}: HeaderProps) => {
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(initialTokenStats || null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [actualTokenBalance, setActualTokenBalance] = useState(tokenBalance);
  const [pendingTokens, setPendingTokens] = useState({ 
    originOnly: 0, 
    qualityOnly: 0, 
    bothCertifications: 0 
  });

  // Mock fetch function for demo
  const fetchTokenStats = async () => {
    setIsLoadingTokens(true);
    setTokenError(null);
    
    // Simulate API call
    setTimeout(() => {
      setTokenStats({
        userId: 1,
        totalTokens: tokenBalance,
        remainingTokens: tokenBalance,
        originOnly: 0,
        qualityOnly: 0,
        bothCertifications: 0,
        usedTokens: 0
      });
      setIsLoadingTokens(false);
    }, 1000);
  };

  useEffect(() => {
    const totalPendingTokens = pendingTokens.originOnly + pendingTokens.qualityOnly + pendingTokens.bothCertifications;
    const baseTokens = tokenStats?.remainingTokens ?? tokenBalance;
    const availableTokens = Math.max(0, baseTokens - totalPendingTokens);
    setActualTokenBalance(availableTokens);
  }, [tokenBalance, tokenStats, pendingTokens]);

  const handleRefreshTokens = () => {
    fetchTokenStats();
  };

  const handleDashboardClick = () => {
    router.push('/admin/dashboard');
  };

  return (
    <header className="relative bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/20 text-black overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-amber-500/5"></div>
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-400/10 to-transparent rounded-full blur-2xl"></div>
      
      <div className="relative z-10 flex justify-between items-center">
        <div className="flex items-center">
          <button 
            onClick={toggleSidebar}
            className="mr-4 p-2 rounded-lg hover:bg-yellow-100/50 transition-all duration-300 hover:scale-110"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center">
            <div className="mr-3 bg-gradient-to-br from-yellow-500 to-amber-500 p-2 rounded-xl shadow-lg transform hover:scale-110 transition-all duration-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM6 14C5.45 14 5 13.55 5 13C5 12.45 5.45 12 6 12C6.55 12 7 12.45 7 13C7 13.55 6.55 14 6 14ZM9 9C8.45 9 8 8.55 8 8C8 7.45 8.45 7 9 7C9.55 7 10 7.45 10 8C10 8.55 9.55 9 9 9ZM15 9C14.45 9 14 8.55 14 8C14 7.45 14.45 7 15 7C15.55 7 16 7.45 16 8C16 8.55 15.55 9 15 9ZM18 14C17.45 14 17 13.55 17 13C17 12.45 17.45 12 18 12C18.55 12 19 12.45 19 13C19 13.55 18.55 14 18 14Z" fill="white"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">HoneyCertify</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Token Balance Section - More Compact */}
          <div className="group relative mr-3 bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-xl
                         p-4 rounded-xl border border-gray-700/30 shadow-xl
                         transform transition-all duration-500 hover:scale-105
                         flex items-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-purple-500/10
                            opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            {/* Status indicators - smaller */}
            <div className="absolute top-1.5 right-3 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></div>
            {tokenError && (
              <div className="absolute top-1.5 left-3 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
            )}
            
            <div className="relative z-10">
              <Wallet className="h-6 w-6 text-yellow-400 mr-3 transition-all duration-300
                                group-hover:text-yellow-300 group-hover:scale-110
                                drop-shadow-lg" />
            </div>
            
            <div className="flex-1 relative z-10">
              <div className="flex items-center mb-0.5">
                <p className="text-xs text-gray-400 transition-all duration-300 group-hover:text-gray-300">
                  Available Tokens
                </p>
                {(pendingTokens.originOnly + pendingTokens.qualityOnly + pendingTokens.bothCertifications) > 0 && (
                  <div className="ml-2 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full border border-orange-400/30">
                    {pendingTokens.originOnly + pendingTokens.qualityOnly + pendingTokens.bothCertifications} pending
                  </div>
                )}
                {isLoadingTokens && (
                  <div className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-400/30">
                    Loading...
                  </div>
                )}
              </div>
              
              <div className="flex items-center">
                <p className="text-lg font-bold bg-gradient-to-r from-yellow-400 to-yellow-200
                              bg-clip-text text-transparent transition-all duration-300
                              group-hover:from-yellow-300 group-hover:to-white">
                  {isLoadingTokens ? '...' : actualTokenBalance}
                </p>
                
                <button
                  onClick={handleRefreshTokens}
                  disabled={isLoadingTokens}
                  className="ml-2 p-0.5 rounded-full hover:bg-gray-700/50 transition-all duration-300 disabled:opacity-50"
                  title="Refresh token balance"
                >
                  <RefreshCw className={`h-3 w-3 text-gray-400 hover:text-yellow-400 transition-all duration-300 ${isLoadingTokens ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            <button
              onClick={() => router.push('/buy-token')}
              className="group/btn relative ml-4 px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500
                        text-white rounded-lg font-medium text-sm overflow-hidden
                        transform transition-all duration-300
                        hover:from-yellow-400 hover:to-amber-400
                        hover:scale-110 hover:shadow-xl hover:shadow-yellow-500/30
                        active:scale-95 flex items-center"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                              transform -skew-x-12 -translate-x-full
                              group-hover/btn:translate-x-full transition-transform duration-700"></div>
              
              <PlusCircle className="h-4 w-4 mr-1.5 relative z-10 transition-transform duration-300
                                    group-hover/btn:rotate-180" />
              <span className="relative z-10">Buy</span>
            </button>
          </div>

          {/* Action Buttons - More Compact */}
          <button
            onClick={handleDashboardClick}
            className="group relative overflow-hidden px-4 py-2.5 rounded-lg font-medium text-sm shadow-lg
                       transform transition-all duration-500 flex items-center
                       bg-gradient-to-r from-purple-600 to-violet-500 text-white
                       hover:from-purple-500 hover:to-violet-400 
                       hover:scale-105 hover:shadow-purple-500/30
                       active:scale-95
                       border border-purple-400/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                           transform -skew-x-12 -translate-x-full 
                           group-hover:translate-x-full transition-transform duration-700"></div>
            <LayoutDashboard className="h-4 w-4 mr-2 relative z-10 transition-all duration-300 
                                      group-hover:rotate-12 group-hover:scale-110" />
            <span className="relative z-10 transition-all duration-300">
              Dashboard
            </span>
          </button>

          <button
            onClick={() => setShowBatchModal(true)}
            className="group relative overflow-hidden px-4 py-2.5 
                       bg-gradient-to-r from-emerald-600 to-green-500 
                       text-white rounded-lg font-medium text-sm shadow-lg
                       transform transition-all duration-500 
                       hover:from-emerald-500 hover:to-green-400 
                       hover:scale-105 hover:shadow-green-500/30
                       active:scale-95
                       flex items-center border border-green-400/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 
                           transform -skew-x-12 -translate-x-full 
                           group-hover:translate-x-full transition-transform duration-1000"></div>
            
            <Package className="w-4 h-4 mr-2 relative z-10 transition-all duration-300 
                              group-hover:rotate-12 group-hover:scale-110" />
            <span className="relative z-10 transition-all duration-300">
              Create Batch
            </span>
          </button>

          <button
            onClick={() => router.push('/premium')}
            className="group relative overflow-hidden px-4 py-2.5 
                       bg-gradient-to-r from-amber-500 to-yellow-500 
                       text-white rounded-lg font-medium text-sm shadow-lg
                       transform transition-all duration-500 
                       hover:from-amber-400 hover:to-yellow-400 
                       hover:scale-105 hover:shadow-yellow-500/30
                       active:scale-95
                       flex items-center border border-yellow-400/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent 
                           transform -skew-x-12 -translate-x-full 
                           group-hover:translate-x-full transition-transform duration-800"></div>
            
            <Star className="w-4 h-4 mr-2 relative z-10 transition-all duration-300 
                           group-hover:rotate-12 group-hover:scale-110" />
            <span className="relative z-10 transition-all duration-300">
              Premium
            </span>
          </button>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="group relative overflow-hidden px-4 py-2.5
                       bg-gradient-to-r from-red-600 to-rose-500
                       text-white rounded-lg font-medium text-sm shadow-lg
                       transform transition-all duration-500
                       hover:from-red-500 hover:to-rose-400
                       hover:scale-105 hover:shadow-red-500/30
                       active:scale-95
                       flex items-center border border-red-400/20
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                            transform -skew-x-12 -translate-x-full
                            group-hover:translate-x-full transition-transform duration-600"></div>
            
            <LogOut className={`w-4 h-4 mr-2 relative z-10 transition-all duration-300
                             group-hover:-rotate-12 group-hover:scale-110
                             ${isLoggingOut ? 'animate-spin' : ''}`} />
            
            <span className="relative z-10 transition-all duration-300">
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </span>
          </button>
        </div>
      </div>
      
      <p className="text-gray-600 text-xs mt-3 relative z-10 opacity-75">
        Last updated: {lastUpdated}
      </p>
    </header>
  );
};

export default Header;