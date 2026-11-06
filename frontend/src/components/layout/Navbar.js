import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth, homeFor, isVerifiedDoctor } from '../../context/AuthContext';
import { FiSun, FiMoon, FiMenu, FiX, FiLogOut, FiUser, FiCamera, FiClock, FiSearch, FiHome, FiActivity, FiUserPlus, FiCalendar, FiShield } from 'react-icons/fi';

const Navbar = () => {
  const { darkMode, toggleTheme } = useTheme();
  const { user, isAuthenticated, isDoctor, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    setIsOpen(false);
    navigate('/');
  };

  const navLinks = isAuthenticated
    ? isDoctor
      ? (isVerifiedDoctor(user)
          ? [{ to: '/doctor/appointments', label: 'Appointments', icon: FiCalendar }, { to: '/doctor/profile', label: 'My Profile', icon: FiUser }]
          : [{ to: '/doctor/pending', label: 'Verification', icon: FiShield }, { to: '/doctor/profile', label: 'My Profile', icon: FiUser }])
      : isAdmin
        ? [{ to: '/admin', label: 'Admin', icon: FiShield }]
        : [
            { to: '/dashboard', label: 'Dashboard', icon: FiHome },
            { to: '/scan', label: 'New Scan', icon: FiCamera },
            { to: '/history', label: 'History', icon: FiClock },
            { to: '/appointments', label: 'Appointments', icon: FiCalendar },
          
          ]
    : [
        { to: '/', label: 'Home', icon: FiHome },
        { to: '/features', label: 'Features', icon: FiActivity },
      ];

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'));
  const profileHome = homeFor(user);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/30 transition-shadow">
              <FiCamera className="text-white text-lg" />
            </div>
            <span className="text-xl font-bold gradient-text">DermaScan AI</span>
          </Link>

          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                  isActive(link.to)
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <link.icon className="text-base" />
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {darkMode ? <FiSun className="text-lg" /> : <FiMoon className="text-lg" />}
            </motion.button>

            {isAuthenticated ? (
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setProfileOpen(!profileOpen)}
                  aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Account menu"
                  className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-semibold">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user?.name?.split(' ')[0] || 'User'}</span>
                </motion.button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 p-2"
                    >
                      <Link
                        to={profileHome}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FiUser className="text-lg" />
                        <span className="text-sm font-medium">{user?.email}</span>
                      </Link>
                      <hr className="my-1 border-gray-100 dark:border-gray-700" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <FiLogOut className="text-lg" />
                        <span className="text-sm font-medium">Sign Out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/login" className="btn-secondary text-sm py-2.5 px-5">
                  Sign In
                </Link>
                <Link to="/register" className="btn-primary text-sm py-2.5 px-5">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'} aria-expanded={isOpen}
            className="md:hidden p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            {isOpen ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <link.icon className="text-lg" />
                  <span>{link.label}</span>
                </Link>
              ))}
              <hr className="my-2 border-gray-100 dark:border-gray-700" />
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <FiLogOut className="text-lg" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              ) : (
                <div className="flex flex-col space-y-2 pt-2">
                  <Link to="/login" onClick={() => setIsOpen(false)} className="btn-secondary text-sm text-center py-3">
                    Sign In
                  </Link>
                  <Link to="/register" onClick={() => setIsOpen(false)} className="btn-primary text-sm text-center py-3">
                    Get Started
                  </Link>
                </div>
              )}
              <button
                onClick={toggleTheme}
                className="flex items-center space-x-3 w-full px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {darkMode ? <FiSun className="text-lg" /> : <FiMoon className="text-lg" />}
                <span className="text-sm font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
