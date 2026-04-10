import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Health check
export const getHealth = async () => {
  const response = await api.get("/health");
  return response.data;
};

// Status
export const getStatus = async () => {
  const response = await api.get("/status");
  return response.data;
};

// Channels
export const getChannels = async () => {
  const response = await api.get("/channels");
  return response.data;
};

export const getChannel = async (id: string) => {
  const response = await api.get(`/channels/${id}`);
  return response.data;
};

export const createChannelMapping = async (data: any) => {
  const response = await api.post("/channels/mapping", data);
  return response.data;
};

export const updateChannelMapping = async (id: string, data: any) => {
  const response = await api.put(`/channels/mapping/${id}`, data);
  return response.data;
};

export const deleteChannelMapping = async (id: string) => {
  await api.delete(`/channels/mapping/${id}`);
};

// Config
export const getConfig = async () => {
  const response = await api.get("/config");
  return response.data;
};

export const updateConfig = async (data: any) => {
  const response = await api.put("/config", data);
  return response.data;
};

export default api;
