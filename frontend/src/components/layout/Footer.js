import React from 'react';
import { Link } from 'react-router-dom';
import { FiCamera, FiMail, FiPhone, FiMapPin, FiHeart } from 'react-icons/fi';

const Footer = () => {
  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
                <FiCamera className="text-white text-lg" />
              </div>
              <span className="text-xl font-bold gradient-text">DermaScan AI</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              AI-powered skin disease detection system providing fast, accurate analysis for better healthcare outcomes.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { to: '/', label: 'Home' },
                { to: '/features', label: 'Features' },
                { to: '/scan', label: 'Skin Analysis' },
                { to: '/doctors', label: 'Find Doctors' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Support</h4>
            <ul className="space-y-3">
              {[
                { to: '#', label: 'Help Center' },
                { to: '#', label: 'Privacy Policy' },
                { to: '#', label: 'Terms of Service' },
                { to: '#', label: 'Contact Us' },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.to} className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                <FiMail className="text-primary-500 flex-shrink-0" />
                <span>support@dermascan.ai</span>
              </li>
              <li className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                <FiPhone className="text-primary-500 flex-shrink-0" />
                <span>+27 (256) 123-4567</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <p className="text-sm text-gray-400 dark:text-gray-500 flex items-center space-x-1">
              <span>&copy; 2024 DermaScan AI. All rights reserved.</span>
              <span className="flex items-center ml-1">
                Made with <FiHeart className="text-red-500 mx-1" /> for better healthcare
              </span>
            </p>
            <div className="flex items-center space-x-4">
              <span className="text-xs text-gray-400">Disclaimer: This tool is for informational purposes only and does not replace professional medical advice.</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
