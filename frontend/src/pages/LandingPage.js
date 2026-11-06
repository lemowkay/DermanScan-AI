import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCamera, FiCpu, FiShield, FiUserCheck, FiArrowRight, FiCheckCircle, FiTrendingUp, FiClock, FiActivity } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: 'easeOut' } }),
};

const Features = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[
      { icon: FiCamera, title: 'Fast Detection', desc: 'Get AI analysis results within seconds after uploading your skin image.', color: 'from-primary-500 to-sky-500' },
      { icon: FiCpu, title: 'AI-Powered Analysis', desc: 'Advanced deep learning model trained on thousands of dermatological images.', color: 'from-sky-500 to-primary-600' },
      { icon: FiShield, title: 'Secure Reports', desc: 'Your medical data is encrypted and stored securely with HIPAA compliance.', color: 'from-medical-500 to-primary-500' },
      { icon: FiUserCheck, title: 'Doctor Consultation', desc: 'Connect with certified dermatologists for professional medical advice.', color: 'from-primary-600 to-sky-500' },
    ].map((feature, i) => (
      <motion.div key={feature.title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="group relative bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      >
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <feature.icon className="text-white text-2xl" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
      </motion.div>
    ))}
  </div>
);

const stats = [
  { icon: FiActivity, value: '50K+', label: 'Scans Completed', color: 'from-primary-500 to-sky-500' },
  { icon: FiTrendingUp, value: '95%', label: 'Accuracy Rate', color: 'from-medical-500 to-primary-500' },
  { icon: FiClock, value: '<30s', label: 'Average Scan Time', color: 'from-sky-500 to-primary-600' },
  { icon: FiUserCheck, value: '200+', label: 'Certified Doctors', color: 'from-primary-600 to-sky-500' },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 via-white to-sky-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800/50" />
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-300/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-sky-300/20 rounded-full blur-3xl" />
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
                <motion.div variants={fadeUp} className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-medium mb-6 border border-primary-100 dark:border-primary-800">
                  <FiActivity className="mr-2" />
                  AI-Powered Dermatology
                </motion.div>
                <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight mb-6">
                  AI Skin Disease{' '}
                  <span className="gradient-text">Detection System</span>
                </motion.h1>
                <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 leading-relaxed mb-8 max-w-xl">
                  Upload an image of your skin and receive instant AI-powered analysis. Fast, accurate, and secure.
                </motion.p>
                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                  <Link to="/register" className="btn-primary text-lg py-4 px-8 inline-flex items-center justify-center space-x-2 group">
                    <span>Start Scan</span>
                    <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link to="/features" className="btn-secondary text-lg py-4 px-8 inline-flex items-center justify-center">
                    Learn More
                  </Link>
                </motion.div>
                <motion.div variants={fadeUp} className="flex items-center space-x-6 mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
                  {['HIPAA Compliant', 'FDA Registered', 'ISO Certified'].map((badge) => (
                    <div key={badge} className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                      <FiCheckCircle className="text-medical-500" />
                      <span>{badge}</span>
                    </div>
                  ))}
                </motion.div>
              </motion.div>

             
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, i) => (
                <motion.div key={stat.label} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="text-center p-6"
                >
                  <div className={`w-14 h-14 mx-auto rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <stat.icon className="text-white text-xl" />
                  </div>
                  <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 lg:py-28" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
              <motion.div variants={fadeUp} className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-medium mb-4 border border-primary-100 dark:border-primary-800">
                Platform Features
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Everything You Need for{' '}
                <span className="gradient-text">Skin Health</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                Comprehensive tools for skin disease detection, analysis, and professional consultation.
              </motion.p>
            </motion.div>
            <Features />
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 lg:py-28 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
              <motion.div variants={fadeUp} className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-medium mb-4 border border-primary-100 dark:border-primary-800">
                Simple Process
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                How It <span className="gradient-text">Works</span>
              </motion.h2>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Upload Image', desc: 'Take or upload a photo of your skin condition using our secure platform.' },
                { step: '02', title: 'AI Analysis', desc: 'Our deep learning model analyzes the image and detects potential skin conditions.' },
                { step: '03', title: 'Get Results', desc: 'Receive a detailed report with diagnosis, confidence score, and recommendations.' },
              ].map((item, i) => (
                <motion.div key={item.step} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="relative text-center p-8"
                >
                  <div className="w-20 h-20 mx-auto rounded-2xl gradient-primary flex items-center justify-center text-2xl font-bold text-white mb-6 shadow-xl shadow-primary-500/20">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{item.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-12 -right-4 text-primary-300 dark:text-primary-600 text-4xl">→</div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 lg:py-28">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                Ready to Check Your{' '}
                <span className="gradient-text">Skin Health?</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                Join thousands of users who trust DermaScan AI for fast, accurate skin disease detection.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register" className="btn-primary text-lg py-4 px-10 inline-flex items-center space-x-2 group">
                  <span>Start Free Scan</span>
                  <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/login" className="btn-secondary text-lg py-4 px-10">
                  Sign In
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;
