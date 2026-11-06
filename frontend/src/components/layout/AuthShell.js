import React from 'react';
import { motion } from 'framer-motion';
import { FiCamera } from 'react-icons/fi';
import Navbar from './Navbar';

const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
    <Navbar />
    <main className="pt-24 lg:pt-28 pb-12 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/20">
            <FiCamera className="text-white text-2xl" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && <p className="text-gray-500 dark:text-gray-400 mt-2">{subtitle}</p>}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
          {children}
        </div>
        {footer && <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">{footer}</p>}
      </motion.div>
    </main>
  </div>
);

export default AuthShell;
