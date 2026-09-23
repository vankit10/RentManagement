jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
  },
}));

import { normalizeAuthResponse } from '../src/services/authService';
import { normalizeTenantList } from '../src/services/tenantService';

describe('normalizeAuthResponse', () => {
  it('accepts wrapped backend responses with success/data', () => {
    const payload = {
      success: true,
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          phone: '9999999999',
          role: 'OWNER',
          organizationId: 'org-1',
        },
      },
    };

    expect(normalizeAuthResponse(payload)).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'user@example.com',
        phone: '9999999999',
        role: 'OWNER',
        organizationId: 'org-1',
      },
    });
  });

  it('accepts direct login payloads', () => {
    const payload = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-2',
        name: 'Another User',
        email: 'other@example.com',
        phone: '8888888888',
        role: 'tenant',
        organizationId: 'org-2',
      },
    };

    expect(normalizeAuthResponse(payload)).toEqual(payload);
  });
});

describe('normalizeTenantList', () => {
  it('accepts wrapped paginated tenant payloads', () => {
    const payload = {
      success: true,
      data: {
        data: [{
          id: 'tenant-1',
          name: 'Ravi Kumar',
          phone: '9999999999',
          room_number: 'A-101',
          joining_date: '2024-01-05',
          rent_amount: 12000,
          due_day: 5,
          status: 'ACTIVE',
        }],
        pagination: { total: 1 },
      },
    };

    expect(normalizeTenantList(payload)).toMatchObject([
      {
        id: 'tenant-1',
        name: 'Ravi Kumar',
        phone: '9999999999',
        room_number: 'A-101',
        joining_date: '2024-01-05',
        rent_amount: 12000,
        due_day: 5,
        status: 'active',
      },
    ]);
  });

  it('accepts direct tenant arrays', () => {
    const payload = [{
      id: 'tenant-2',
      name: 'Priya',
      phone: '8888888888',
      room_number: 'B-202',
      joining_date: '2024-02-10',
      rent_amount: 15000,
      due_day: 10,
      status: 'inactive',
    }];

    expect(normalizeTenantList(payload)).toMatchObject(payload.map(t => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      room_number: t.room_number,
      joining_date: t.joining_date,
      rent_amount: t.rent_amount,
      due_day: t.due_day,
      status: 'inactive',
    })));
  });
});
