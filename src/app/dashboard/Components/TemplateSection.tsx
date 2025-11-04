'use client';

import { useRouter } from 'next/navigation';
import { 
  PenTool,
  Calculator,
  Globe,
  Lightbulb,
  Target,
  Presentation,
  BookOpen,
  Rocket,
  ArrowRight
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

  const handleTemplateClick = (route: string) => {
    router.push(route);
  };

  return (
    <div className="mb-12">
      {/* Nagłówek sekcji */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Skorzystaj z szablonu
          </h2>
          <p className="text-sm text-gray-600">
            Wybierz gotowy szablon lub utwórz własny
          </p>
        </div>
        
        <button className="text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer transition-colors">
          Zobacz wszystkie
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Poziomy scroll z szablonami */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
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
              onClick={() => handleTemplateClick(template.route)}
              className="group relative bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-green-300 hover:shadow-lg transition-all duration-300 cursor-pointer text-left flex-shrink-0 w-[220px]"
            >
              {/* Ikona z gradientem */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${template.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                <IconComponent size={26} className="text-white" />
              </div>

              {/* Nazwa szablonu */}
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                {template.name}
              </h3>

              {/* Opis */}
              <p className="text-xs text-gray-500">
                {template.description}
              </p>

              {/* Hover arrow */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Rocket size={18} className="text-green-600" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}