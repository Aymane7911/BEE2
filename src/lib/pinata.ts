// lib/pinata.ts - Helper functions for Pinata operations

export interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export interface PinataMetadata {
  name: string;
  keyvalues?: Record<string, string>;
}

export interface PinataOptions {
  cidVersion?: 0 | 1;
  wrapWithDirectory?: boolean;
  customPinPolicy?: {
    regions: Array<{
      id: string;
      desiredReplicationCount: number;
    }>;
  };
}

// Function to test Pinata authentication
export async function testPinataConnection(): Promise<boolean> {
  try {
    const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: {
        'pinata_api_key': process.env.PINATA_API_KEY!,
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY!,
      },
    });

    const result = await response.json();
    return result.message === 'Congratulations! You are communicating with the Pinata API!';
  } catch (error) {
    console.error('Pinata connection test failed:', error);
    return false;
  }
}

// Function to upload file to Pinata
export async function uploadFileToPinata(
  file: File, 
  metadata?: PinataMetadata, 
  options?: PinataOptions
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    if (metadata) {
      formData.append('pinataMetadata', JSON.stringify(metadata));
    }

    if (options) {
      formData.append('pinataOptions', JSON.stringify(options));
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': process.env.PINATA_API_KEY!,
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY!,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata upload failed: ${response.statusText} - ${errorText}`);
    }

    const result: PinataUploadResponse = await response.json();
    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error('Pinata upload error:', error);
    throw new Error('Failed to upload file to IPFS');
  }
}

// Function to upload JSON data to Pinata
export async function uploadJSONToPinata(
  jsonData: any,
  metadata?: PinataMetadata,
  options?: PinataOptions
): Promise<string> {
  try {
    const body: any = {
      pinataContent: jsonData,
    };

    if (metadata) {
      body.pinataMetadata = metadata;
    }

    if (options) {
      body.pinataOptions = options;
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': process.env.PINATA_API_KEY!,
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY!,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata JSON upload failed: ${response.statusText} - ${errorText}`);
    }

    const result: PinataUploadResponse = await response.json();
    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error('Pinata JSON upload error:', error);
    throw new Error('Failed to upload JSON to IPFS');
  }
}

// Function to get pinned files from Pinata
export async function getPinnedFiles(pageLimit: number = 10, pageOffset: number = 0) {
  try {
    const url = new URL('https://api.pinata.cloud/data/pinList');
    url.searchParams.append('pageLimit', pageLimit.toString());
    url.searchParams.append('pageOffset', pageOffset.toString());
    url.searchParams.append('status', 'pinned');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'pinata_api_key': process.env.PINATA_API_KEY!,
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY!,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get pinned files: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get pinned files error:', error);
    throw new Error('Failed to retrieve pinned files');
  }
}

// Function to unpin a file from Pinata
export async function unpinFile(ipfsHash: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${ipfsHash}`, {
      method: 'DELETE',
      headers: {
        'pinata_api_key': process.env.PINATA_API_KEY!,
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY!,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Unpin file error:', error);
    return false;
  }
}

// Function to get user's Pinata usage statistics
export async function getPinataUsage() {
  try {
    const response = await fetch('https://api.pinata.cloud/data/userPinnedDataTotal', {
      method: 'GET',
      headers: {
        'pinata_api_key': process.env.PINATA_API_KEY!,
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY!,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get usage data: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get Pinata usage error:', error);
    throw new Error('Failed to retrieve usage data');
  }
}

// Function to update metadata for a pinned file
export async function updateFileMetadata(ipfsHash: string, metadata: PinataMetadata) {
  try {
    const response = await fetch(`https://api.pinata.cloud/pinning/hashMetadata`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': process.env.PINATA_API_KEY!,
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY!,
      },
      body: JSON.stringify({
        ipfsPinHash: ipfsHash,
        ...metadata,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Update metadata error:', error);
    return false;
  }
}