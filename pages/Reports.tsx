import React, { useState, useEffect } from 'react';
import { Card } from '../components/UI';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#ec4899', '#f472b6', '#a78bfa', '#818cf8'];

const Reports: React.FC = () => {
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [serviceData, setServiceData] = useState<any[]>([]);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveData();
  }, []);

  const fetchLiveData = async () => {
    try {
      setLoading(true);

      // Fetch appointments, services, and sales
      const [appointmentsRes, servicesRes, salesRes] = await Promise.all([
        fetch(import.meta.env.VITE_API_URL + '/api/v1/appointments'),
        fetch(import.meta.env.VITE_API_URL + '/api/v1/services'),
        fetch(import.meta.env.VITE_API_URL + '/api/v1/sales')
      ]);

      if (!appointmentsRes.ok || !servicesRes.ok || !salesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [appointments, services, salesData] = await Promise.all([
        appointmentsRes.json(),
        servicesRes.json(),
        salesRes.json()
      ]);

      // Extract sales array if wrapped
      const sales = Array.isArray(salesData) ? salesData : (salesData.sales || []);

      // Calculate revenue by day (last 7 days) using SALES data
      const revenueByDay = calculateRevenueByDay(sales);
      setRevenueData(revenueByDay);

      // Calculate popular services
      const popularServices = calculatePopularServices(appointments, services);
      setServiceData(popularServices);

      // Calculate appointment trends (last 30 days)
      const trends = calculateAppointmentTrends(appointments);
      setTrendsData(trends);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports data:', error);
      // Set default data on error
      setRevenueData([{ name: 'No data', amt: 0 }]);
      setServiceData([{ name: 'No data', value: 0 }]);
      setTrendsData([{ date: 'No data', amt: 0 }]);
      setLoading(false);
    }
  };

  const calculateRevenueByDay = (sales: any[]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const revenueData: Array<{ name: string; amt: number; date: Date }> = [];

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

      revenueData.push({
        name: `${dateStr} ${dayName}`,
        amt: 0,
        date: new Date(date)
      });
    }

    // Calculate revenue from COMPLETED sales
    sales
      .filter(sale => sale.saleStatus !== 'CANCELLED') // Use saleStatus check
      .forEach(sale => {
        const saleDate = new Date(sale.createdAt); // Use createdAt for sales
        const revenue = sale.paidAmount || sale.totalAmount || 0;

        // Find matching day in revenueData (compare date strings)
        const dayData = revenueData.find(d =>
          d.date.toDateString() === saleDate.toDateString()
        );

        if (dayData) {
          dayData.amt += revenue;
        }
      });

    return revenueData.map(({ name, amt }) => ({
      name,
      amt: Math.round(amt)
    }));
  };

  const calculatePopularServices = (appointments: any[], services: any[]) => {
    const serviceCount = new Map<string, number>();

    // Count appointments per service
    appointments.forEach(apt => {
      const serviceId = apt.serviceId;
      serviceCount.set(serviceId, (serviceCount.get(serviceId) || 0) + 1);
    });

    // Get top 5 services
    const sortedServices = Array.from(serviceCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return sortedServices.map(([serviceId, count]) => {
      const service = services.find(s => s.id === serviceId);
      return {
        name: service?.name || 'Unknown',
        value: count
      };
    });
  };

  const calculateAppointmentTrends = (appointments: any[]) => {
    const trendsMap = new Map<string, number>();
    const now = new Date();

    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      trendsMap.set(dateKey, 0);
    }

    // Count appointments per day
    appointments
      .filter(apt => apt.startTime)
      .forEach(apt => {
        const date = new Date(apt.startTime);
        const dateKey = date.toISOString().split('T')[0];
        if (trendsMap.has(dateKey)) {
          trendsMap.set(dateKey, (trendsMap.get(dateKey) || 0) + 1);
        }
      });

    return Array.from(trendsMap.entries()).map(([date, amt]) => ({
      date,
      amt
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-black)' }}>
          Loading reports...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2">
        <Card title="Revenue This Week">
          <div style={{ height: '20rem', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="amt" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Popular Services">
          <div style={{ height: '20rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="justify-center flex" style={{ gap: '1rem', fontSize: '0.875rem', color: 'var(--text-black)', marginTop: '0.5rem' }}>
            {serviceData.map((entry, index) => (
              <div key={index} className="flex items-center">
                <span style={{ width: 12, height: 12, borderRadius: '50%', marginRight: 8, backgroundColor: COLORS[index % COLORS.length] }}></span>
                {entry.name}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Appointment Trends (Last 30 Days)">
        <div style={{ height: '16rem', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendsData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis hide />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="amt" stroke="#8b5cf6" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

export default Reports;
