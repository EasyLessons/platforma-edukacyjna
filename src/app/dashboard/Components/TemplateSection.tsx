'use client';

import { useRouter } from 'next/navigation';
import { useWorkspaces } from '@/app/context/WorkspaceContext';
import { createBoard } from '@/boards_api/api';
import { useState, useRef, useEffect } from 'react';
import { 
  Target,
  BookOpen,
  Rocket,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Calendar
} from 'lucide-react';

// Typy dla struktury egzaminów
interface ExamSession {
  id: string;
  name: string;
  folder: string; // ścieżka do folderu z arkuszami
}

interface ExamYear {
  year: number;
  sessions: ExamSession[];
}

interface ExamCategory {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  years: ExamYear[];
}

// Dane egzaminów z latami i sesjami
const examCategories: ExamCategory[] = [
  {
    id: 'matura-podstawowa',
    name: 'Matura podstawowa',
    description: 'Przygotowanie do matury',
    icon: Target,
    color: 'bg-green-500',
    years: [
      {
        year: 2025,
        sessions: [
          { id: '2025-main', name: 'Matura główna (maj)', folder: '/arkusze/matura-podstawowa/2025/glowna' },
          { id: '2025-dodatkowa', name: 'Matura dodatkowa (czerwiec)', folder: '/arkusze/matura-podstawowa/2025/dodatkowa' },
          { id: '2025-poprawkowa', name: 'Matura poprawkowa (sierpień)', folder: '/arkusze/matura-podstawowa/2025/poprawkowa' },
        ]
      },
      {
        year: 2024,
        sessions: [
          { id: '2024-main', name: 'Matura główna (maj)', folder: '/arkusze/matura-podstawowa/2024/glowna' },
          { id: '2024-dodatkowa', name: 'Matura dodatkowa (czerwiec)', folder: '/arkusze/matura-podstawowa/2024/dodatkowa' },
          { id: '2024-poprawkowa', name: 'Matura poprawkowa (sierpień)', folder: '/arkusze/matura-podstawowa/2024/poprawkowa' },
        ]
      },
      {
        year: 2023,
        sessions: [
          { id: '2023-main', name: 'Matura główna (maj)', folder: '/arkusze/matura-podstawowa/2023/glowna' },
          { id: '2023-poprawkowa', name: 'Matura poprawkowa (sierpień)', folder: '/arkusze/matura-podstawowa/2023/poprawkowa' },
        ]
      },
    ]
  },
  {
    id: 'matura-rozszerzona',
    name: 'Matura rozszerzona',
    description: 'Poziom rozszerzony',
    icon: Rocket,
    color: 'bg-purple-500',
    years: [
      {
        year: 2025,
        sessions: [
          { id: '2025-main', name: 'Matura główna (maj)', folder: '/arkusze/matura-rozszerzona/2025/glowna' },
          { id: '2025-dodatkowa', name: 'Matura dodatkowa (czerwiec)', folder: '/arkusze/matura-rozszerzona/2025/dodatkowa' },
          { id: '2025-poprawkowa', name: 'Matura poprawkowa (sierpień)', folder: '/arkusze/matura-rozszerzona/2025/poprawkowa' },
        ]
      },
      {
        year: 2024,
        sessions: [
          { id: '2024-main', name: 'Matura główna (maj)', folder: '/arkusze/matura-rozszerzona/2024/glowna' },
          { id: '2024-dodatkowa', name: 'Matura dodatkowa (czerwiec)', folder: '/arkusze/matura-rozszerzona/2024/dodatkowa' },
          { id: '2024-poprawkowa', name: 'Matura poprawkowa (sierpień)', folder: '/arkusze/matura-rozszerzona/2024/poprawkowa' },
        ]
      },
      {
        year: 2023,
        sessions: [
          { id: '2023-main', name: 'Matura główna (maj)', folder: '/arkusze/matura-rozszerzona/2023/glowna' },
          { id: '2023-poprawkowa', name: 'Matura poprawkowa (sierpień)', folder: '/arkusze/matura-rozszerzona/2023/poprawkowa' },
        ]
      },
    ]
  },
  {
    id: 'egzamin-8-klasisty',
    name: 'Egzamin 8-klasisty',
    description: 'Matematyka podstawówka',
    icon: BookOpen,
    color: 'bg-orange-500',
    years: [
      {
        year: 2025,
        sessions: [
          { id: '2025-main', name: 'Egzamin główny (maj)', folder: '/arkusze/egzamin-8/2025/glowny' },
        ]
      },
      {
        year: 2024,
        sessions: [
          { id: '2024-main', name: 'Egzamin główny (maj)', folder: '/arkusze/egzamin-8/2024/glowny' },
        ]
      },
      {
        year: 2023,
        sessions: [
          { id: '2023-main', name: 'Egzamin główny (maj)', folder: '/arkusze/egzamin-8/2023/glowny' },
        ]
      },
    ]
  }
];

export default function TemplatesSection() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspaces();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Stan dla rozwiniętych kategorii i lat
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  
  // Refs dla animacji wysokości
  const categoryContentRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const yearContentRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  
  // Stany dla rzeczywistych wysokości (do animacji)
  const [categoryHeights, setCategoryHeights] = useState<{[key: string]: number}>({});
  const [yearHeights, setYearHeights] = useState<{[key: string]: number}>({});

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(prev => prev === categoryId ? null : categoryId);
    // Reset expanded years when closing category
    if (expandedCategory === categoryId) {
      setExpandedYears(new Set());
    }
  };

  const toggleYear = (categoryId: string, year: number) => {
    const key = `${categoryId}-${year}`;
    setExpandedYears(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Aktualizuj wysokości po zmianie stanu (dla płynnych animacji)
  useEffect(() => {
    const updateHeights = () => {
      const newCategoryHeights: {[key: string]: number} = {};
      const newYearHeights: {[key: string]: number} = {};
      
      // Najpierw zmierz wysokości lat (zagnieżdżone)
      Object.keys(yearContentRefs.current).forEach(yearKey => {
        const element = yearContentRefs.current[yearKey];
        if (element) {
          // Tymczasowo ustaw wysokość na auto żeby zmierzyć
          const originalHeight = element.style.height;
          element.style.height = 'auto';
          newYearHeights[yearKey] = element.scrollHeight;
          element.style.height = originalHeight;
        }
      });
      
      // Potem zmierz wysokości kategorii (zawierają lata)
      Object.keys(categoryContentRefs.current).forEach(categoryId => {
        const element = categoryContentRefs.current[categoryId];
        if (element) {
          // Tymczasowo ustaw wysokość na auto żeby zmierzyć
          const originalHeight = element.style.height;
          element.style.height = 'auto';
          newCategoryHeights[categoryId] = element.scrollHeight;
          element.style.height = originalHeight;
        }
      });
      
      setCategoryHeights(newCategoryHeights);
      setYearHeights(newYearHeights);
    };

    // Małe opóźnienie żeby DOM się zaktualizował
    const timer = setTimeout(updateHeights, 50);
    return () => clearTimeout(timer);
  }, [expandedCategory, expandedYears]);

  const handleSessionClick = async (session: ExamSession, categoryName: string, year: number) => {
    if (!activeWorkspace) {
      console.error('Brak aktywnego workspace');
      return;
    }

    try {
      const boardName = `${categoryName} ${year} - ${session.name}`;
      
      // 1. Utwórz nową tablicę w bazie danych
      const newBoard = await createBoard({
        name: boardName,
        workspace_id: activeWorkspace.id,
        icon: 'FileText',
        bg_color: 'green-500'
      });
      
      console.log(`✅ Utworzono tablicę: ${newBoard.id}`);
      
      // 2. Przekieruj do tablicy z boardId i folderem arkusza
      const fullRoute = `/tablica?boardId=${newBoard.id}&arkusz=${encodeURIComponent(session.folder)}`;
      
      router.push(fullRoute);
      
    } catch (err) {
      console.error('❌ Błąd tworzenia tablicy:', err);
    }
  };

  return (
    <div className="mb-6 md:mb-12">
      {/* Nagłówek sekcji */}
      <div className="flex items-center justify-between mb-3 md:mb-6">
        <div>
          <h2 className="text-base md:text-2xl font-bold text-gray-900">
            Arkusze egzaminacyjne
          </h2>
          <p className="hidden md:block text-sm text-gray-600">
            Wybierz egzamin i rok, aby rozpocząć rozwiązywanie
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Strzałki na desktop */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={scrollLeft}
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-full p-1.5 shadow-sm transition-all hover:shadow-md"
            >
              <ChevronLeft size={14} className="text-gray-600" />
            </button>
            <button
              onClick={scrollRight}
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-full p-1.5 shadow-sm transition-all hover:shadow-md"
            >
              <ChevronRight size={14} className="text-gray-600" />
            </button>
          </div>
          
          <button className="text-xs md:text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer transition-colors">
            Zobacz wszystkie
            <ArrowRight size={14} className="md:w-4 md:h-4" />
          </button>
        </div>
      </div>

      {/* Karty egzaminów */}
      <div 
        ref={scrollContainerRef}
        className="flex items-start gap-3 md:gap-4 overflow-x-auto pb-2 md:pb-4 scrollbar-hide"
      >
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
          
        {examCategories.map((category) => {
          const IconComponent = category.icon;
          const isExpanded = expandedCategory === category.id;
          
          return (
            <div
              key={category.id}
              className={`relative bg-white rounded-lg md:rounded-2xl border-2 transition-all duration-300 flex-shrink-0 self-start ${
                isExpanded 
                  ? 'border-green-300 shadow-lg min-w-[280px] md:min-w-[320px]' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md min-w-[160px] md:min-w-[220px]'
              }`}
            >
              {/* Nagłówek karty - kliknięcie rozwija/zwija */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full p-3 md:p-5 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-xl ${category.color} flex items-center justify-center shadow-md`}>
                    <IconComponent size={20} className="text-white md:w-6 md:h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">
                      {category.name}
                    </h3>
                    <p className="text-xs text-gray-500 hidden md:block">
                      {category.description}
                    </p>
                  </div>
                  <ChevronDown 
                    size={18} 
                    className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} 
                  />
                </div>
              </button>

              {/* Rozwijana lista lat - z animacją */}
              <div 
                className="overflow-hidden transition-all duration-300 ease-in-out border-t border-gray-100"
                style={{
                  maxHeight: isExpanded 
                    ? (categoryHeights[category.id] ? `${categoryHeights[category.id]}px` : 'none')
                    : '0px'
                }}
              >
                <div 
                  ref={(el) => {categoryContentRefs.current[category.id] = el}}
                  className="px-3 pb-3 md:px-4 md:pb-4"
                >
                  {category.years.map((yearData) => {
                    const yearKey = `${category.id}-${yearData.year}`;
                    const isYearExpanded = expandedYears.has(yearKey);
                    
                    return (
                      <div key={yearData.year} className="mt-2">
                        {/* Przycisk roku */}
                        <button
                          onClick={() => toggleYear(category.id, yearData.year)}
                          className="w-full flex items-center justify-between p-2 md:p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-500" />
                            <span className="font-medium text-gray-700 text-sm">{yearData.year}</span>
                          </div>
                          <ChevronDown 
                            size={14} 
                            className={`text-gray-400 transition-transform duration-200 ${isYearExpanded ? 'rotate-180' : ''}`} 
                          />
                        </button>

                        {/* Lista sesji egzaminacyjnych - z animacją */}
                        <div 
                          className="overflow-hidden transition-all duration-300 ease-in-out"
                          style={{
                            maxHeight: isYearExpanded 
                              ? (yearHeights[yearKey] ? `${yearHeights[yearKey]}px` : 'none')
                              : '0px'
                          }}
                        >
                          <div 
                            ref={(el) => {yearContentRefs.current[yearKey] = el}}
                            className="mt-1 ml-2 space-y-1"
                          >
                            {yearData.sessions.map((session) => (
                              <button
                                key={session.id}
                                onClick={() => handleSessionClick(session, category.name, yearData.year)}
                                className="w-full flex items-center gap-2 p-2 hover:bg-green-50 rounded-lg transition-colors group text-left"
                              >
                                <FileText size={14} className="text-gray-400 group-hover:text-green-500 flex-shrink-0" />
                                <span className="text-xs md:text-sm text-gray-600 group-hover:text-green-700 truncate">
                                  {session.name}
                                </span>
                                <ArrowRight size={12} className="text-gray-300 group-hover:text-green-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}