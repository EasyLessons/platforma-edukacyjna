'use client';

import { useRouter } from 'next/navigation';
import { useWorkspaces } from '@/app/context/WorkspaceContext';
import { createBoard } from '@/boards_api/api';
import { useRef } from 'react';
import { 
  PenTool,
  Calculator,
  Globe,
  Lightbulb,
  Target,
  Presentation,
  BookOpen,
  Rocket,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
  route: string;
}

export default function TemplatesSection() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspaces();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const templates: Template[] = [
    {
      id: '1',
      name: 'Pusta tablica',
      description: 'Zacznij od zera',
      icon: PenTool,
      color: 'bg-gray-500',
      gradient: 'from-gray-400 to-gray-600',
      route: '/tablica'
    },
    {
      id: '2',
      name: 'Matematyka',
      description: 'Ogólne wzory i równania',
      icon: Calculator,
      color: 'bg-blue-500',
      gradient: 'from-blue-400 to-blue-600',
      route: '/tablica?template=math'
    },
    {
      id: '3',
      name: 'Matura podstawowa',
      description: 'Przygotowanie do matury',
      icon: Target,
      color: 'bg-green-500',
      gradient: 'from-green-400 to-green-600',
      route: '/tablica?template=matura-basic'
    },
    {
      id: '4',
      name: 'Matura rozszerzona',
      description: 'Poziom rozszerzony',
      icon: Rocket,
      color: 'bg-purple-500',
      gradient: 'from-purple-400 to-purple-600',
      route: '/tablica?template=matura-advanced'
    },
    {
      id: '5',
      name: 'Egzamin 8-klasisty',
      description: 'Matematyka podstawówka',
      icon: BookOpen,
      color: 'bg-orange-500',
      gradient: 'from-orange-400 to-orange-600',
      route: '/tablica?template=exam-8'
    },
    {
      id: '6',
      name: 'Algebra',
      description: 'Równania i funkcje',
      icon: Calculator,
      color: 'bg-indigo-500',
      gradient: 'from-indigo-400 to-indigo-600',
      route: '/tablica?template=algebra'
    },
    {
      id: '7',
      name: 'Geometria',
      description: 'Figury i bryły',
      icon: Globe,
      color: 'bg-teal-500',
      gradient: 'from-teal-400 to-teal-600',
      route: '/tablica?template=geometry'
    },
    {
      id: '8',
      name: 'Trygonometria',
      description: 'Sin, cos, tan',
      icon: Target,
      color: 'bg-pink-500',
      gradient: 'from-pink-400 to-pink-600',
      route: '/tablica?template=trigonometry'
    },
    {
      id: '9',
      name: 'Analiza matematyczna',
      description: 'Pochodne i całki',
      icon: Lightbulb,
      color: 'bg-yellow-500',
      gradient: 'from-yellow-400 to-yellow-600',
      route: '/tablica?template=calculus'
    },
    {
      id: '10',
      name: 'Statystyka',
      description: 'Prawdopodobieństwo',
      icon: Presentation,
      color: 'bg-red-500',
      gradient: 'from-red-400 to-red-600',
      route: '/tablica?template=statistics'
    }
  ];

  const handleTemplateClick = async (route: string, templateName: string) => {
    if (!activeWorkspace) {
      console.error('Brak aktywnego workspace');
      return;
    }

    try {
      // 1. Utwórz nową tablicę w bazie danych
      const newBoard = await createBoard({
        name: templateName,
        workspace_id: activeWorkspace.id,
        icon: 'PenTool',
        bg_color: 'gray-500'
      });
      
      console.log(`✅ Utworzono tablicę: ${newBoard.id}`);
      
      // 2. Przekieruj do tablicy z boardId (i opcjonalnie template)
      const hasTemplate = route.includes('template=');
      const fullRoute = hasTemplate 
        ? `/tablica?boardId=${newBoard.id}&${route.split('?')[1]}`
        : `/tablica?boardId=${newBoard.id}`;
      
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
            Skorzystaj z szablonu
          </h2>
          <p className="hidden md:block text-sm text-gray-600">
            Wybierz gotowy szablon lub utwórz własny
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

      {/* Poziomy scroll z szablonami */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-2 md:gap-4 overflow-x-auto pb-2 md:pb-4 scrollbar-hide"
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
          
        {templates.map((template) => {
          const IconComponent = template.icon;
          
          return (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template.route, template.name)}
              className="group relative bg-gray-200/25 rounded-lg md:rounded-2xl p-3 md:p-6 border-3 border-gray-200/50 hover:bg-gray-200/50 hover:shadow-lg transition-all duration-300 cursor-pointer text-left flex-shrink-0 min-w-[140px] max-w-[180px] md:min-w-[200px] md:max-w-[280px]"
            >
              {/* Desktop Layout */}
              <div className="hidden md:block">
                <div className={`w-14 h-14 flex-shrink-0 rounded-xl ${template.color} flex items-center justify-center mb-4 group-hover:scale-100 transition-transform duration-300 shadow-md`}>
                  <IconComponent size={26} className="text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                  {template.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {template.description}
                </p>
              </div>

              {/* Mobile Layout - ikonka po lewej, nazwa po prawej */}
              <div className="md:hidden flex items-center gap-3">
                <div className={`w-8 h-8 flex-shrink-0 rounded-lg ${template.color} flex items-center justify-center group-hover:scale-100 transition-transform duration-300 shadow-md`}>
                  <IconComponent size={16} className="text-white" />
                </div>
                <h3 className="font-medium text-gray-900 text-xs leading-tight flex-1">
                  {template.name}
                </h3>
              </div>

              {/* Hover arrow - tylko na desktop */}
              <div className="hidden md:block absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Rocket size={18} className="text-green-600" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}