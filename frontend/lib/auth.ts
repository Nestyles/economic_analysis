interface LoginResponse {
  access_token: string;
  token_type: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
}

const AUTH_TOKEN_KEY = 'token';

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await fetch("http://localhost:8000/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username,
        password,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || "Login failed");
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }    throw new Error("An unexpected error occurred");
  }
};

export const register = async (data: RegisterData): Promise<void> => {
  const response = await fetch("http://localhost:8000/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Registration failed");
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem("token", token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem("token");
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};
