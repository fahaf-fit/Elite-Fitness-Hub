import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "ar";

interface LanguageContextType {
  lang: Language;
  toggleLang: () => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const translations: Record<string, Record<Language, string>> = {
  "nav.home": { en: "Home", ar: "الرئيسية" },
  "nav.plans": { en: "Plans", ar: "الباقات" },
  "nav.workouts": { en: "Workouts", ar: "التمارين" },
  "nav.profile": { en: "Profile", ar: "الملف الشخصي" },
  "nav.login": { en: "Login", ar: "تسجيل الدخول" },
  "nav.signup": { en: "Sign Up", ar: "إنشاء حساب" },
  "nav.logout": { en: "Logout", ar: "تسجيل الخروج" },

  "home.title": { en: "Practice with Fahad", ar: "تدرب مع فهد" },
  "home.subtitle": { en: "Elite Personal Training", ar: "تدريب شخصي احترافي" },
  "home.cta": { en: "Start Your Journey", ar: "ابدأ رحلتك" },
  "home.explore": { en: "Explore Plans", ar: "استعرض الباقات" },
  "home.stat1": { en: "Members", ar: "عضو" },
  "home.stat2": { en: "Programs", ar: "برنامج" },
  "home.stat3": { en: "Years", ar: "سنوات" },
  "home.stat4": { en: "Success Rate", ar: "نسبة النجاح" },
  "home.about.title": { en: "About Fahad", ar: "عن فهد" },
  "home.about.text": {
    en: "Professional certified trainer with over 8 years of experience transforming bodies and minds. Specializing in strength training, conditioning, and personalized nutrition plans for serious athletes and beginners alike.",
    ar: "مدرب محترف ومعتمد بخبرة تزيد عن 8 سنوات في تحويل الأجسام والعقول. متخصص في تدريب القوة والتكييف وخطط التغذية الشخصية للرياضيين الجادين والمبتدئين على حد سواء."
  },
  "home.features.title": { en: "Why Choose Fahad?", ar: "لماذا تختار فهد؟" },
  "home.f1.title": { en: "Certified Expert", ar: "خبير معتمد" },
  "home.f1.desc": { en: "International certifications in fitness and nutrition", ar: "شهادات دولية في اللياقة البدنية والتغذية" },
  "home.f2.title": { en: "Custom Programs", ar: "برامج مخصصة" },
  "home.f2.desc": { en: "Tailored workout plans for your specific goals", ar: "خطط تدريب مصممة خصيصاً لأهدافك" },
  "home.f3.title": { en: "24/7 Support", ar: "دعم على مدار الساعة" },
  "home.f3.desc": { en: "Always available to guide your fitness journey", ar: "متاح دائماً لإرشادك في رحلتك الرياضية" },
  "home.f4.title": { en: "Proven Results", ar: "نتائج مثبتة" },
  "home.f4.desc": { en: "Hundreds of successful transformations documented", ar: "مئات التحولات الناجحة الموثقة" },

  "plans.title": { en: "Training Plans", ar: "باقات التدريب" },
  "plans.subtitle": { en: "Choose the plan that fits your goals", ar: "اختر الباقة التي تناسب أهدافك" },
  "plans.basic": { en: "Basic", ar: "الأساسية" },
  "plans.pro": { en: "Pro", ar: "الاحترافية" },
  "plans.elite": { en: "Elite", ar: "النخبة" },
  "plans.monthly": { en: "/month", ar: "/شهر" },
  "plans.cta": { en: "Get Started", ar: "ابدأ الآن" },
  "plans.popular": { en: "Most Popular", ar: "الأكثر شيوعاً" },
  "plans.basic.desc": { en: "Perfect for beginners starting their fitness journey", ar: "مثالية للمبتدئين الذين يبدؤون رحلتهم الرياضية" },
  "plans.pro.desc": { en: "Ideal for intermediate athletes pushing limits", ar: "مثالية للرياضيين المتوسطين الذين يتخطون حدودهم" },
  "plans.elite.desc": { en: "Maximum intensity for serious competitors", ar: "أقصى شدة لمن يتنافسون بجدية" },

  "login.title": { en: "Welcome Back", ar: "مرحباً بعودتك" },
  "login.subtitle": { en: "Sign in to your account", ar: "تسجيل الدخول إلى حسابك" },
  "login.email": { en: "Email Address", ar: "البريد الإلكتروني" },
  "login.password": { en: "Password", ar: "كلمة المرور" },
  "login.btn": { en: "Sign In", ar: "تسجيل الدخول" },
  "login.no_account": { en: "Don't have an account?", ar: "ليس لديك حساب؟" },
  "login.signup_link": { en: "Sign Up", ar: "إنشاء حساب" },

  "signup.title": { en: "Create Account", ar: "إنشاء حساب" },
  "signup.subtitle": { en: "Start your transformation today", ar: "ابدأ تحولك اليوم" },
  "signup.name": { en: "Full Name", ar: "الاسم الكامل" },
  "signup.email": { en: "Email Address", ar: "البريد الإلكتروني" },
  "signup.birthdate": { en: "Birth Date", ar: "تاريخ الميلاد" },
  "signup.phone": { en: "Phone Number", ar: "رقم الهاتف" },
  "signup.password": { en: "Password", ar: "كلمة المرور" },
  "signup.confirm": { en: "Confirm Password", ar: "تأكيد كلمة المرور" },
  "signup.robot": { en: "I'm not a robot", ar: "لست روبوتاً" },
  "signup.btn": { en: "Create Account", ar: "إنشاء الحساب" },
  "signup.have_account": { en: "Already have an account?", ar: "لديك حساب بالفعل؟" },
  "signup.login_link": { en: "Sign In", ar: "تسجيل الدخول" },

  "profile.title": { en: "My Profile", ar: "ملفي الشخصي" },
  "profile.subscription": { en: "Subscription", ar: "الاشتراك" },
  "profile.status.active": { en: "Active", ar: "نشط" },
  "profile.status.expired": { en: "Expired", ar: "منتهي" },
  "profile.start": { en: "Start Date", ar: "تاريخ البدء" },
  "profile.end": { en: "End Date", ar: "تاريخ الانتهاء" },
  "profile.invoices": { en: "Invoices", ar: "الفواتير" },
  "profile.plan": { en: "Plan", ar: "الباقة" },
  "profile.amount": { en: "Amount", ar: "المبلغ" },
  "profile.date": { en: "Date", ar: "التاريخ" },
  "profile.change_photo": { en: "Change Photo", ar: "تغيير الصورة" },
  "profile.edit": { en: "Edit Profile", ar: "تعديل الملف" },
  "profile.save": { en: "Save Changes", ar: "حفظ التغييرات" },

  "workouts.title": { en: "My Workouts", ar: "التمارين" },
  "workouts.subtitle": { en: "Your personalized training program", ar: "برنامجك التدريبي المخصص" },
  "workouts.protected": { en: "Members Only", ar: "للأعضاء فقط" },
  "workouts.login_to_view": { en: "Please login to access your workouts", ar: "يرجى تسجيل الدخول للوصول إلى تمارينك" },
  "workouts.day": { en: "Day", ar: "يوم" },
  "workouts.sets": { en: "sets", ar: "مجموعات" },
  "workouts.reps": { en: "reps", ar: "تكرار" },
  "workouts.rest": { en: "rest", ar: "راحة" },

  "common.login": { en: "Login", ar: "تسجيل الدخول" },
  "common.back": { en: "Back", ar: "رجوع" },
  "common.kd": { en: "KD", ar: "د.ك" },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("en");

  const toggleLang = () => setLang((l) => (l === "en" ? "ar" : "en"));

  const t = (key: string): string => {
    return translations[key]?.[lang] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t, isRTL: lang === "ar" }}>
      <div dir={lang === "ar" ? "rtl" : "ltr"} className={lang === "ar" ? "font-arabic" : ""}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
