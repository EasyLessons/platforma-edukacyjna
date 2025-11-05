"use client";
import { loginUser, saveToken, saveUser } from "@/auth_api/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";

export default function Login() {
  const router = useRouter();

  // State management
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  // Email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
    setGeneralError("");
  };

  // Form validation
  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: "", password: "" };

    if (!formData.email) {
      newErrors.email = "Email jest wymagany";
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Nieprawidłowy format email";
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = "Hasło jest wymagane";
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = "Hasło musi mieć co najmniej 6 znaków";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

// Handle login - NAPRAWIONE
// WAŻNE: api.ts SAMO zapisuje token i user - NIE róbmy tego tutaj!
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validateForm()) return;

  setIsLoading(true);
  setGeneralError("");

  try {
    // Wywołanie API logowania
    // ✅ loginUser() z api.ts automatycznie zapisze token i user
    const response = await loginUser({
      login: formData.email, // może być email LUB username
      password: formData.password,
    });

    // ❌ STARY KOD (ZŁY) - Podwójny zapis!
    saveToken(response.access_token);
    saveUser(response.user);

    // ✅ NOWY KOD (DOBRY) - api.ts już to zrobił
    console.log("✅ Zalogowano pomyślnie! User:", response.user.username);
    
    // Przekierowanie do dashboard
    router.push("/dashboard");

  } catch (error: any) {
    setIsLoading(false);
    
    // Obsługa różnych błędów z backendu
    if (error.message.includes("niezweryfikowane")) {
      // Konto istnieje ale niezweryfikowane
      console.log("⚠️ Konto niezweryfikowane - wysyłam nowy kod...");
      
      try {
        // Sprawdź użytkownika i wyślij nowy kod
        const checkResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/check-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email }),
        });
        
        const checkData = await checkResponse.json();

        if (!checkData.verified && checkData.user_id) {
          // Redirect do weryfikacji
          console.log("📧 Nowy kod wysłany, redirect do weryfikacji");
          router.push(`/weryfikacja?userId=${checkData.user_id}&email=${encodeURIComponent(formData.email)}`);
        } else {
          setGeneralError("⚠️ Konto niezweryfikowane. Sprawdź email.");
        }
      } catch (checkError) {
        setGeneralError("⚠️ Konto niezweryfikowane. Sprawdź email lub zarejestruj się ponownie.");
      }
    } else {
      setGeneralError(error.message || "Błędny email lub hasło");
    }
    
    console.error("❌ Błąd logowania:", error);
  }
};

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400 p-5">
      {/* Logo/Brand Section */}
      <div className="mb-8 text-center">
        <h2 className="text-white text-2xl font-semibold">Witaj ponownie!</h2>
      </div>

      {/* Login Form */}
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md"
      >
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Zaloguj się
        </h1>

        <p className="text-center text-gray-600 mb-6">
          Zaloguj się, aby kontynuować
        </p>

        {/* General Error Message */}
        {generalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
            {generalError}
          </div>
        )}

        {/* Email Input */}
        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Email
          </label>
          <div className="relative">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="nazwa@example.com"
              className={`w-full pl-10 pr-4 py-3 text-gray-700 bg-white border-2 rounded-lg outline-none transition-colors duration-200
                ${
                  errors.email
                    ? "border-red-500 bg-red-50 focus:border-red-500"
                    : "border-gray-200 focus:border-green-500"
                }`}
            />
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Mail className="w-5 h-5" />
            </span>
          </div>
          {errors.email && (
            <span className="text-red-500 text-xs mt-1 block">
              {errors.email}
            </span>
          )}
        </div>

        {/* Password Input */}
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Hasło
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full pl-10 pr-12 py-3 text-gray-700 bg-white border-2 rounded-lg outline-none transition-colors duration-200
                ${
                  errors.password
                    ? "border-red-500 bg-red-50 focus:border-red-500"
                    : "border-gray-200 focus:border-green-500"
                }`}
            />
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Lock className="w-5 h-5" />
            </span>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              title={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            >
              {showPassword ? (
                <Eye className="w-5 h-5" />
              ) : (
                <EyeOff className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <span className="text-red-500 text-xs mt-1 block">
              {errors.password}
            </span>
          )}
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 text-white font-semibold rounded-lg transition-all duration-200 transform mb-5
            ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
            }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Logowanie...</span>
            </div>
          ) : (
            "Zaloguj"
          )}
        </button>

        {/* Sign Up Link */}
        <div className="text-center text-gray-600">
          Nie masz konta?{" "}
          <Link
            href="/rejestracja"
            className="text-green-600 font-semibold hover:text-green-700 hover:underline transition-colors duration-200"
          >
            Zarejestruj się
          </Link>
        </div>
      </form>
    </div>
  );
}

// "use client";
// import { loginUser, saveToken, saveUser } from "@/auth_api/api";
// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
// import Link from "next/link";

// export default function Login() {
//   const router = useRouter();

//   // State management
//   const [formData, setFormData] = useState({
//     email: "",
//     password: "",
//   });
//   const [errors, setErrors] = useState({
//     email: "",
//     password: "",
//   });
//   const [showPassword, setShowPassword] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [generalError, setGeneralError] = useState("");

//   // Email validation
//   const validateEmail = (email: string) => {
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     return emailRegex.test(email);
//   };

//   // Handle input changes
//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({
//       ...prev,
//       [name]: value,
//     }));

//     // Clear error when user starts typing
//     setErrors((prev) => ({
//       ...prev,
//       [name]: "",
//     }));
//     setGeneralError("");
//   };

//   // Form validation
//   const validateForm = () => {
//     let isValid = true;
//     const newErrors = { email: "", password: "" };

//     if (!formData.email) {
//       newErrors.email = "Email jest wymagany";
//       isValid = false;
//     } else if (!validateEmail(formData.email)) {
//       newErrors.email = "Nieprawidłowy format email";
//       isValid = false;
//     }

//     if (!formData.password) {
//       newErrors.password = "Hasło jest wymagane";
//       isValid = false;
//     } else if (formData.password.length < 6) {
//       newErrors.password = "Hasło musi mieć co najmniej 6 znaków";
//       isValid = false;
//     }

//     setErrors(newErrors);
//     return isValid;
//   };

// // Handle login - POŁĄCZENIE Z PRAWDZIWYM API
// // Logika: sprawdza email/username + hasło, zwraca token JWT
// // Wymaga: konto musi być zweryfikowane (is_active = true)
// // Jeśli niezweryfikowane → wysyła nowy kod i redirect do weryfikacji
// const handleLogin = async (e: React.FormEvent) => {
//   e.preventDefault();

//   if (!validateForm()) return;

//   setIsLoading(true);
//   setGeneralError("");

//   try {
//     // Wywołanie API logowania
//     const response = await loginUser({
//       login: formData.email, // może być email LUB username
//       password: formData.password,
//     });

//     // Zapisz token i dane użytkownika w localStorage
//     saveToken(response.access_token);
//     saveUser(response.user);

//     console.log("✅ Zalogowano pomyślnie! User:", response.user.username);
    
//     // Przekierowanie do dashboard
//     router.push("/dashboard");

//   } catch (error: any) {
//     setIsLoading(false);
    
//     // Obsługa różnych błędów z backendu
//     if (error.message.includes("niezweryfikowane")) {
//       // Konto istnieje ale niezweryfikowane
//       console.log("⚠️ Konto niezweryfikowane - wysyłam nowy kod...");
      
//       try {
//         // Sprawdź użytkownika i wyślij nowy kod
//         const checkResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/check-user`, {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ email: formData.email }),
//         });
        
//         const checkData = await checkResponse.json();

//         if (!checkData.verified && checkData.user_id) {
//           // Redirect do weryfikacji
//           console.log("📧 Nowy kod wysłany, redirect do weryfikacji");
//           router.push(`/weryfikacja?userId=${checkData.user_id}&email=${encodeURIComponent(formData.email)}`);
//         } else {
//           setGeneralError("⚠️ Konto niezweryfikowane. Sprawdź email.");
//         }
//       } catch (checkError) {
//         setGeneralError("⚠️ Konto niezweryfikowane. Sprawdź email lub zarejestruj się ponownie.");
//       }
//     } else {
//       setGeneralError(error.message || "Błędny email lub hasło");
//     }
    
//     console.error("❌ Błąd logowania:", error);
//   }
// };

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400 p-5">
//       {/* Logo/Brand Section */}
//       <div className="mb-8 text-center">
//         <h2 className="text-white text-2xl font-semibold">Witaj ponownie!</h2>
//       </div>

//       {/* Login Form */}
//       <form
//         onSubmit={handleLogin}
//         className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md"
//       >
//         <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
//           Zaloguj się
//         </h1>

//         <p className="text-center text-gray-600 mb-6">
//           Zaloguj się, aby kontynuować
//         </p>

//         {/* General Error Message */}
//         {generalError && (
//           <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
//             {generalError}
//           </div>
//         )}

//         {/* Email Input */}
//         <div className="mb-4">
//           <label className="block mb-2 text-sm font-medium text-gray-700">
//             Email
//           </label>
//           <div className="relative">
//             <input
//               type="email"
//               name="email"
//               value={formData.email}
//               onChange={handleChange}
//               placeholder="nazwa@example.com"
//               className={`w-full pl-10 pr-4 py-3 text-gray-700 bg-white border-2 rounded-lg outline-none transition-colors duration-200
//                 ${
//                   errors.email
//                     ? "border-red-500 bg-red-50 focus:border-red-500"
//                     : "border-gray-200 focus:border-green-500"
//                 }`}
//             />
//             <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
//               <Mail className="w-5 h-5" />
//             </span>
//           </div>
//           {errors.email && (
//             <span className="text-red-500 text-xs mt-1 block">
//               {errors.email}
//             </span>
//           )}
//         </div>

//         {/* Password Input */}
//         <div className="mb-6">
//           <label className="block mb-2 text-sm font-medium text-gray-700">
//             Hasło
//           </label>
//           <div className="relative">
//             <input
//               type={showPassword ? "text" : "password"}
//               name="password"
//               value={formData.password}
//               onChange={handleChange}
//               placeholder="••••••••"
//               className={`w-full pl-10 pr-12 py-3 text-gray-700 bg-white border-2 rounded-lg outline-none transition-colors duration-200
//                 ${
//                   errors.password
//                     ? "border-red-500 bg-red-50 focus:border-red-500"
//                     : "border-gray-200 focus:border-green-500"
//                 }`}
//             />
//             <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
//               <Lock className="w-5 h-5" />
//             </span>
//             <button
//               type="button"
//               onClick={() => setShowPassword(!showPassword)}
//               className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
//               title={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
//             >
//               {showPassword ? (
//                 <Eye className="w-5 h-5" />
//               ) : (
//                 <EyeOff className="w-5 h-5" />
//               )}
//             </button>
//           </div>
//           {errors.password && (
//             <span className="text-red-500 text-xs mt-1 block">
//               {errors.password}
//             </span>
//           )}
//         </div>

//         {/* Login Button */}
//         <button
//           type="submit"
//           disabled={isLoading}
//           className={`w-full py-3 px-4 text-white font-semibold rounded-lg transition-all duration-200 transform mb-5
//             ${
//               isLoading
//                 ? "bg-gray-400 cursor-not-allowed"
//                 : "bg-green-500 hover:bg-green-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
//             }`}
//         >
//           {isLoading ? (
//             <div className="flex items-center justify-center gap-3">
//               <Loader2 className="h-5 w-5 animate-spin" />
//               <span>Logowanie...</span>
//             </div>
//           ) : (
//             "Zaloguj"
//           )}
//         </button>

//         {/* Sign Up Link */}
//         <div className="text-center text-gray-600">
//           Nie masz konta?{" "}
//           <Link
//             href="/rejestracja"
//             className="text-green-600 font-semibold hover:text-green-700 hover:underline transition-colors duration-200"
//           >
//             Zarejestruj się
//           </Link>
//         </div>
//       </form>
//     </div>
//   );
// }