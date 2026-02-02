import { useState, useEffect } from 'react';
import { loyaltyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import './Loyalty.css';

const Loyalty = () => {
  const { user } = useAuth();
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [history, setHistory] = useState([]);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLoyaltyData();
  }, []);

  const loadLoyaltyData = async () => {
    try {
      setLoading(true);
      const [pointsRes, historyRes] = await Promise.all([
        loyaltyAPI.getPoints(),
        loyaltyAPI.getHistory().catch(() => ({ data: [] }))
      ]);
      setLoyaltyData(pointsRes.data);
      setHistory(historyRes.data || []);
    } catch (error) {
      console.error('Error cargando datos de lealtad:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemPoints || redeemPoints <= 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Puntos inválidos',
        text: 'Ingresa una cantidad válida de puntos'
      });
      return;
    }

    if (redeemPoints > (loyaltyData?.points || 0)) {
      await Swal.fire({
        icon: 'warning',
        title: 'Puntos insuficientes',
        text: 'No tienes suficientes puntos para canjear'
      });
      return;
    }

    const result = await Swal.fire({
      title: '¿Canjear puntos?',
      html: `
        <p>Vas a canjear <strong>${redeemPoints}</strong> puntos</p>
        <p>Obtendrás un descuento de <strong>$${(redeemPoints * 0.01).toFixed(2)}</strong></p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, canjear',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await loyaltyAPI.redeem(redeemPoints);
        await Swal.fire({
          icon: 'success',
          title: '¡Puntos canjeados!',
          text: 'El descuento se aplicará en tu próxima compra',
          timer: 2000
        });
        setRedeemPoints(0);
        loadLoyaltyData();
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.message || 'No se pudieron canjear los puntos'
        });
      }
    }
  };

  const getTierInfo = (tier) => {
    const tiers = {
      'bronze': { class: 'tier-bronze', next: 'Silver', pointsNeeded: 500 },
      'silver': { class: 'tier-silver', next: 'Gold', pointsNeeded: 1500 },
      'gold': { class: 'tier-gold', next: 'Platinum', pointsNeeded: 5000 },
      'platinum': { class: 'tier-platinum', next: null, pointsNeeded: null }
    };
    return tiers[tier?.toLowerCase()] || tiers['bronze'];
  };

  const tierInfo = getTierInfo(loyaltyData?.tier);
  const progressPercent = loyaltyData?.tier === 'platinum' 
    ? 100 
    : Math.min(100, ((loyaltyData?.totalPoints || 0) / (tierInfo.pointsNeeded || 500)) * 100);

  if (loading) {
    return (
      <main className="container my-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-3">Cargando programa de lealtad...</p>
      </main>
    );
  }

  return (
    <main className="container my-5">
      <div className="row">
        <div className="col-12">
          <h1 className="text-center mb-4 site-title">
            <i className="fas fa-star me-2"></i>
            Programa de Lealtad
          </h1>

          {/* Tarjeta principal */}
          <div className="loyalty-card mb-4">
            <div className="row align-items-center">
              <div className="col-md-6 text-center text-md-start mb-3 mb-md-0">
                <span className={`tier-badge ${tierInfo.class}`}>
                  {loyaltyData?.tier || 'Bronze'}
                </span>
                <h5 className="mt-3 mb-0">{user?.nombre || user?.email}</h5>
              </div>
              <div className="col-md-6 text-center text-md-end">
                <div className="points-display">
                  {loyaltyData?.points || 0}
                </div>
                <p className="mb-0">Puntos disponibles</p>
              </div>
            </div>

            {/* Barra de progreso */}
            {tierInfo.next && (
              <div className="mt-4">
                <div className="d-flex justify-content-between mb-1">
                  <span>Progreso hacia {tierInfo.next}</span>
                  <span>{loyaltyData?.totalPoints || 0} / {tierInfo.pointsNeeded}</span>
                </div>
                <div className="progress progress-custom">
                  <div 
                    className="progress-bar progress-bar-custom" 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="row">
            {/* Canjear puntos */}
            <div className="col-md-6 mb-4">
              <div className="card p-4 h-100">
                <h5><i className="fas fa-gift me-2"></i>Canjear Puntos</h5>
                <p className="text-muted">100 puntos = $10.00 de descuento</p>

                <div className="mb-3">
                  <label className="form-label">Puntos a canjear</label>
                  <input
                    type="number"
                    className="form-control"
                    value={redeemPoints}
                    onChange={(e) => setRedeemPoints(parseInt(e.target.value) || 0)}
                    min="0"
                    max={loyaltyData?.points || 0}
                  />
                </div>

                <div className="mb-3">
                  <p className="mb-1">Descuento estimado:</p>
                  <h4 className="text-success">${(redeemPoints * 0.01).toFixed(2)}</h4>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleRedeem}
                  disabled={redeemPoints <= 0 || redeemPoints > (loyaltyData?.points || 0)}
                >
                  <i className="fas fa-exchange-alt me-2"></i>
                  Canjear puntos
                </button>
              </div>
            </div>

            {/* Beneficios del nivel */}
            <div className="col-md-6 mb-4">
              <div className="card p-4 h-100">
                <h5><i className="fas fa-crown me-2"></i>Beneficios de tu Nivel</h5>
                
                <ul className="list-unstyled mt-3">
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    $0-$10: 50 pts · $10-$50: 100 pts · $50+: 200 pts
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    Acceso a promociones exclusivas
                  </li>
                  {(loyaltyData?.tier === 'silver' || loyaltyData?.tier === 'gold' || loyaltyData?.tier === 'platinum') && (
                    <li className="mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      Puntos x1.5 en compras especiales
                    </li>
                  )}
                  {(loyaltyData?.tier === 'gold' || loyaltyData?.tier === 'platinum') && (
                    <li className="mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      Envío gratis en todas las compras
                    </li>
                  )}
                  {loyaltyData?.tier === 'platinum' && (
                    <li className="mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      Descuento adicional del 5%
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Historial */}
          <div className="card p-4">
            <h5><i className="fas fa-history me-2"></i>Historial de Puntos</h5>
            
            {history.length === 0 ? (
              <p className="text-muted mb-0">No hay movimientos aún.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th className="text-end">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 10).map((item, index) => (
                      <tr key={index}>
                        <td>{new Date(item.fecha || item.date).toLocaleDateString('es-EC')}</td>
                        <td>{item.descripcion || item.description}</td>
                        <td className={`text-end ${item.puntos > 0 ? 'text-success' : 'text-danger'}`}>
                          {item.puntos > 0 ? '+' : ''}{item.puntos || item.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Loyalty;
