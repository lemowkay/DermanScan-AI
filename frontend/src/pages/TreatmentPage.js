import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiInfo, FiAlertTriangle, FiThumbsUp, FiHeart, FiShoppingBag, FiActivity, FiShield } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const TreatmentPage = () => {
  const { id } = useParams();

  const treatment = {
    disease: 'Actinic Keratosis',
    description: 'Actinic keratosis (AK) is a rough, scaly patch on the skin that develops from years of sun exposure. It is considered precancerous and requires medical attention to prevent progression to squamous cell carcinoma.',
    causes: [
      'Prolonged UV exposure from sunlight',
      'Tanning bed use',
      'Fair skin type',
      'Weakened immune system',
      'Advanced age',
    ],
    symptoms: [
      'Rough, dry, or scaly patches of skin',
      'Flat or slightly raised lesions',
      'Pink, red, or brown coloration',
      'Itching or burning sensation in affected area',
      'Cracking or bleeding in advanced cases',
    ],
    selfCare: [
      'Apply broad-spectrum sunscreen SPF 30+ daily',
      'Wear protective clothing and wide-brimmed hats',
      'Avoid sun exposure during peak hours (10 AM - 4 PM)',
      'Moisturize affected areas regularly',
      'Perform regular skin self-examinations',
      'Document changes with photos monthly',
    ],
    lifestyle: [
      'Maintain a diet rich in antioxidants (berries, leafy greens)',
      'Stay hydrated - drink at least 8 glasses of water daily',
      'Avoid smoking and excessive alcohol consumption',
      'Incorporate Vitamin D supplementation carefully',
      'Practice stress reduction techniques',
      'Get adequate sleep for skin repair',
    ],
    products: [
      { name: 'Broad-Spectrum Sunscreen SPF 50', desc: 'Daily UV protection', category: 'Sun Protection' },
      { name: 'Moisturizing Cream with Ceramides', desc: 'Repairs skin barrier', category: 'Skincare' },
      { name: 'Vitamin C Serum', desc: 'Antioxidant protection', category: 'Treatment' },
      { name: 'Retinoid Cream (0.025%)', desc: 'Cell turnover enhancement', category: 'Prescription' },
    ],
    warnings: [
      'Lesion becomes painful or tender',
      'Rapid growth or change in appearance',
      'Bleeding or oozing',
      'Development of ulceration',
      'Spread to surrounding skin',
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />
      <div className="pt-20 lg:pt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Link to={'/results/' + id} className="inline-flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-2">
              <FiArrowLeft />
              <span>Back to Results</span>
            </Link>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Recommended Treatment</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Comprehensive care plan for {treatment.disease}</p>
          </div>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
            >
              <div className="flex items-start space-x-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-100 to-sky-100 dark:from-primary-900/30 dark:to-sky-900/30 flex items-center justify-center flex-shrink-0">
                  <FiInfo className="text-2xl text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{treatment.disease}</h2>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{treatment.description}</p>
                </div>
              </div>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <FiAlertTriangle className="text-red-500" />
                  <span>Causes</span>
                </h3>
                <ul className="space-y-3">
                  {treatment.causes.map((item, i) => (
                    <li key={i} className="flex items-start space-x-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <FiActivity className="text-primary-500" />
                  <span>Symptoms</span>
                </h3>
                <ul className="space-y-3">
                  {treatment.symptoms.map((item, i) => (
                    <li key={i} className="flex items-start space-x-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <FiThumbsUp className="text-medical-500" />
                <span>Self-Care Recommendations</span>
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {treatment.selfCare.map((item, i) => (
                  <div key={i} className="flex items-start space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <span className={'w-6 h-6 rounded-full bg-gradient-to-br from-medical-400 to-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0'}>
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <FiHeart className="text-rose-500" />
                <span>Lifestyle Advice</span>
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {treatment.lifestyle.map((item, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <FiShoppingBag className="text-primary-500" />
                <span>Recommended Products</span>
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {treatment.products.map((product, i) => (
                  <div key={i} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">{product.category}</span>
                    <p className="font-semibold text-gray-900 dark:text-white mt-1">{product.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{product.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800 p-6"
            >
              <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-4 flex items-center space-x-2">
                <FiShield className="text-red-500" />
                <span>Warning Signs - Seek Medical Attention Immediately</span>
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {treatment.warnings.map((item, i) => (
                  <div key={i} className="flex items-start space-x-3 p-3 rounded-xl bg-white/50 dark:bg-red-900/10">
                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">!</span>
                    <span className="text-sm font-medium text-red-700 dark:text-red-400">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="text-center p-4">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                This information is for educational purposes only. Always consult a qualified healthcare provider for medical advice.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TreatmentPage;
