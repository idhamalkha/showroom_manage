export type AuthState = { 
  accessToken: string | null; 
  role?: string | null;
  user?: any | null;
};

// Initialize from localStorage - always read fresh
const initialState = (): AuthState => {
  try {
    const accessToken = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    return {
      accessToken,
      role,
      user
    };
  } catch (error) {
    console.error('Error parsing auth storage:', error);
    // Fallback jika ada error parsing
    return {
      accessToken: null,
      role: null,
      user: null
    };
  }
};

let _auth: AuthState = initialState();

export const setAuth = (a: AuthState) => {
  _auth = a;
  try {
    // Sync dengan localStorage
    if (a.accessToken) {
      localStorage.setItem('authToken', a.accessToken);
      localStorage.setItem('userRole', a.role || '');
      localStorage.setItem('user', JSON.stringify(a.user || null));
    } else {
      // Clear semua auth-related items
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('user');
    }
  } catch (error) {
    console.error('Error saving auth to storage:', error);
  }
};

export const getAuth = (): AuthState => {
  // Always read fresh from localStorage to ensure we get latest state
  return initialState();
};