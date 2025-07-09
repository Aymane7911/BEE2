import React, { useState, useRef } from 'react';
import { X, Upload, Check, User, FileText, Camera, Shield, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ProfileFormProps {
  show: boolean;
  setShow: (value: boolean) => void;
  onSuccess?: () => void;
}

const ProfileForm: React.FC<ProfileFormProps> = ({
  show,
  setShow,
  onSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  
  // State management
  const [profileData, setProfileData] = useState({
    passportId: '',
    passportScan: null as File | null,
  });
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [showCameraOptions, setShowCameraOptions] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Token retrieval function
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

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear messages when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Only PNG, JPG, and PDF files are allowed.');
        return;
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setError('File size must be less than 10MB.');
        return;
      }

      setProfileData(prev => ({
        ...prev,
        passportScan: file
      }));
      setError(null);
    }
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhoto(file);
    }
  };

  const handleCaptureClick = () => {
    setShowCameraOptions(true);
  };

  const handleOpenFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get authentication token
      const token = getTokenFromStorage();
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      // Validate required fields
      if (!profileData.passportId.trim()) {
        throw new Error('Passport ID is required');
      }

      if (!profileData.passportScan) {
        throw new Error('Passport document is required');
      }

      // Create form data for file upload
      const formData = new FormData();
      formData.append('passportId', profileData.passportId.trim());
      formData.append('passportScan', profileData.passportScan);
      
      // Add profile photo if provided
      if (profilePhoto) {
        formData.append('profilePhoto', profilePhoto);
      }

      // Submit to API with authentication header
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      setSuccess('Profile updated successfully!');
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Close modal after a short delay
      setTimeout(() => {
        setShow(false);
        setSuccess(null);
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSubmitLoading(false);
    }
  };

  const isFormValid = profileData.passportId.trim() && profileData.passportScan;

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Complete Your Profile</h3>
                <p className="text-blue-100 text-sm">Required for certificate generation</p>
              </div>
            </div>
            <button
              onClick={() => setShow(false)}
              className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                profileData.passportId ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                {profileData.passportId ? <CheckCircle2 className="h-4 w-4" /> : '1'}
              </div>
              <span className="text-sm font-medium">Passport ID</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300">
              <div className={`h-full transition-all duration-300 ${
                profileData.passportId ? 'bg-green-500 w-full' : 'bg-blue-500 w-0'
              }`} />
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                profileData.passportScan ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'
              }`}>
                {profileData.passportScan ? <CheckCircle2 className="h-4 w-4" /> : '2'}
              </div>
              <span className="text-sm font-medium">Document Upload</span>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {(error || success) && (
          <div className="mx-6 mt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-green-700">{success}</span>
              </div>
            )}
          </div>
        )}

        {/* Form Content */}
        <div className="p-6 bg-gray-50 overflow-y-auto max-h-[calc(90vh-200px)]">
          <form onSubmit={handleProfileSubmit}>
            {/* Section 1: Basic Information */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800">Basic Information</h4>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Passport ID */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Beekeeper Passport ID *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={profileData.passportId}
                        onChange={(e) => handleProfileChange('passportId', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter your passport ID (e.g., BK-2024-001234)"
                        required
                        autoFocus
                      />
                      {profileData.passportId && (
                        <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Your unique identification number from the beekeeping association
                    </p>
                  </div>

                  {/* Profile Photo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile Photo (Optional)
                    </label>
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="bg-gray-200 border-2 border-dashed border-gray-400 rounded-full w-16 h-16 flex items-center justify-center overflow-hidden">
                          {profilePhoto ? (
                            <img 
                              src={URL.createObjectURL(profilePhoto)} 
                              alt="Profile" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-8 w-8 text-gray-500" />
                          )}
                        </div>
                        {profilePhoto && (
                          <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <button 
                        type="button"
                        onClick={() => profilePhotoRef.current?.click()}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm transition-colors"
                      >
                        {profilePhoto ? 'Change Photo' : 'Upload Photo'}
                      </button>
                      <input
                        type="file"
                        ref={profilePhotoRef}
                        onChange={handleProfilePhotoUpload}
                        accept=".jpg,.jpeg,.png"
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Document Upload */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="bg-indigo-100 p-2 rounded-lg mr-3">
                  <Upload className="h-5 w-5 text-indigo-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800">Document Upload</h4>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Document Upload Area */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Passport Document *
                    </label>
                    
                    <div className="relative">
                      <div 
                        onClick={handleOpenFileDialog}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                          profileData.passportScan 
                            ? 'border-green-300 bg-green-50 hover:bg-green-100' 
                            : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                        }`}
                      >
                        {profileData.passportScan ? (
                          <>
                            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                            <p className="text-green-600 font-medium">
                              ✓ {profileData.passportScan.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Click to change document
                            </p>
                          </>
                        ) : (
                          <>
                            <Upload className="h-12 w-12 mx-auto text-blue-400 mb-3" />
                            <p className="text-blue-600 font-medium">
                              Click to upload passport scan
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              PDF, JPG, PNG up to 10MB
                            </p>
                          </>
                        )}
                      </div>
                      
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                      />
                    </div>

                    {/* Camera Option */}
                    <div className="mt-4">
                      <button 
                        type="button"
                        onClick={handleCaptureClick}
                        className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo Instead
                      </button>
                    </div>
                    
                    {showCameraOptions && (
                      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 text-sm mb-3">
                          Camera access is required to take a photo of your passport
                        </p>
                        <div className="flex space-x-2">
                          <button 
                            type="button"
                            className="px-4 py-2 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600 transition-colors"
                          >
                            Allow Camera
                          </button>
                          <button 
                            type="button"
                            onClick={() => setShowCameraOptions(false)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Information Panel */}
                  <div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                      <div className="flex items-center mb-3">
                        <Shield className="h-5 w-5 text-blue-600 mr-2" />
                        <h4 className="font-semibold text-blue-800">Security & Privacy</h4>
                      </div>
                      <ul className="space-y-2 text-sm text-blue-700">
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Passport ID verifies your beekeeper certification</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Document scan ensures authenticity</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Information appears on honey certificates</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>We never share your data with third parties</span>
                        </li>
                      </ul>
                    </div>

                    {/* File Format Help */}
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h5 className="font-medium text-gray-700 mb-2">Accepted Formats</h5>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-white p-2 rounded border text-center">
                          <FileText className="h-4 w-4 mx-auto text-red-500 mb-1" />
                          <span>PDF</span>
                        </div>
                        <div className="bg-white p-2 rounded border text-center">
                          <FileText className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                          <span>JPG</span>
                        </div>
                        <div className="bg-white p-2 rounded border text-center">
                          <FileText className="h-4 w-4 mx-auto text-green-500 mb-1" />
                          <span>PNG</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Required fields:</span> Passport ID, Document scan
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShow(false)}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                    disabled={submitLoading}
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    disabled={!isFormValid || submitLoading}
                    className={`px-8 py-3 rounded-lg text-white font-medium transition-all duration-200 flex items-center space-x-2 ${
                      isFormValid && !submitLoading
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105' 
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {submitLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        <span>Save Profile</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileForm;